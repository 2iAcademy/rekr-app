import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MAIL_SENDER, type MailSender } from '../mail/mail-sender.interface';
import { buildPasswordResetEmail } from './password-reset-email';
import { hashPassword } from './password-hash';
import { RefreshTokenService } from './refresh-token.service';
import { hashToken } from './token-hash';

const TOKEN_BYTES = 32;
const DEFAULT_TTL_MINUTES = 60;
const DEFAULT_APP_URL = 'http://localhost:8082';
const RESET_PATH = '/reinitialiser-mot-de-passe';

/**
 * The one answer every refusal gives. A link that was never issued, one already
 * spent and one past its expiry are indistinguishable on purpose: telling them
 * apart would confirm to a holder of a stolen link that it once existed, and on
 * the expiry case would date it.
 */
const INVALID_LINK = "Ce lien de réinitialisation n'est plus valide.";

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly refreshTokens: RefreshTokenService,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
  ) {}

  /**
   * Resolves the same way whatever it finds — unknown address, deactivated
   * account, mail server down. The endpoint above it answers 204 unconditionally,
   * so nothing here may signal by throwing.
   *
   * The remaining side channel is timing. Detaching the delivery closes the
   * large half of it: an awaited SMTP round trip is hundreds of milliseconds
   * and would make the known-account branch separable in a single call — the
   * same oracle `AuthService.ABSENT_USER_PASSWORD_HASH` exists to close on
   * login.
   *
   * It does not close the channel. The known branch still awaits two local
   * writes the unknown one skips, and that shows: measured here, a median of
   * 6.9 ms against 3.4 ms, twice the whole latency of the short branch. Nor
   * does network jitter cover it — jitter is additive noise over an ordered
   * pair of distributions, so it raises the number of samples an attacker
   * needs and nothing else.
   *
   * It is left as it is because it is not the cheapest oracle on the API:
   * `POST /api/auth/signup` answers 409 on an address already registered,
   * which is the same answer in one unambiguous request. Equalising this
   * endpoint would be work spent on the second-best enumeration path while
   * the first stays open; the day signup stops answering, this comes back.
   */
  async requestReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.isActive) {
      return;
    }

    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const ttlMinutes = this.getTtlMinutes();

    // A second request supersedes the first rather than adding to it: two live
    // links double the window an intercepted e-mail stays useful, and the user
    // who asked twice only ever clicks the newest one.
    await this.invalidatePending(this.prisma, user.id);
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      },
    });

    void this.deliver(user.email, token, ttlMinutes);
  }

  async reset(token: string, password: string): Promise<void> {
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
      // The account may have been deactivated after the link went out.
      // `requestReset` refuses to issue for such an account, and letting a link
      // issued before that through would answer 204 for a password login then
      // refuses anyway. Joined onto the lookup already being made rather than
      // asked in a second query, and refused like the other three cases.
      include: { user: { select: { isActive: true } } },
    });

    if (
      !row ||
      row.usedAt ||
      row.expiresAt.getTime() <= Date.now() ||
      !row.user.isActive
    ) {
      throw new BadRequestException(INVALID_LINK);
    }

    const passwordHash = await hashPassword(password);

    await this.prisma.$transaction(async (tx) => {
      // Compare-and-swap, for the same reason `RefreshTokenService.rotate`
      // uses one: the read above and this write are not atomic together, so a
      // link submitted twice at once would otherwise be spent twice. Under
      // READ COMMITTED the loser re-evaluates `used_at IS NULL` after the
      // winner commits and matches nothing.
      const { count } = await tx.passwordResetToken.updateMany({
        where: { id: row.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      if (count === 0) {
        throw new BadRequestException(INVALID_LINK);
      }

      // The stamp travels with the hash, in this transaction and not beside
      // it: `JwtAuthGuard` refuses every access token issued before it, so a
      // hash committed without it would leave the sessions it is meant to cut
      // running for the rest of the access window.
      await tx.user.update({
        where: { id: row.userId },
        data: { passwordHash, passwordChangedAt: new Date() },
      });

      // Whoever forced the reset is exactly who must be logged out, and the
      // account holder resetting after a suspicion expects the same. The
      // stamp above ends the access tokens, this ends their renewal. Sibling
      // links go too: they were issued to the same address and outlive their
      // purpose.
      await this.refreshTokens.revokeAllForUser(row.userId, tx);
      await this.invalidatePending(tx, row.userId);
    });
  }

  private async invalidatePending(
    client: Pick<PrismaService, 'passwordResetToken'>,
    userId: number,
  ): Promise<void> {
    await client.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  private async deliver(
    email: string,
    token: string,
    ttlMinutes: number,
  ): Promise<void> {
    try {
      await this.mail.send(
        buildPasswordResetEmail({
          to: email,
          link: this.buildLink(token),
          ttlMinutes,
        }),
      );
    } catch (error: unknown) {
      // Swallowed on purpose: the caller has already answered. Only the error
      // class is kept — nodemailer copies the raw SMTP reply into the message,
      // and a rejection quotes the recipient in it, so logging the error
      // itself would name the account in the log line.
      const cause = error instanceof Error ? error.name : 'unknown error';

      this.logger.error(
        `Password reset e-mail could not be delivered: ${cause}`,
      );
    }
  }

  private buildLink(token: string): string {
    const appUrl =
      this.config.get<string>('APP_URL')?.trim().replace(/\/+$/, '') ||
      DEFAULT_APP_URL;

    return `${appUrl}${RESET_PATH}?token=${token}`;
  }

  private getTtlMinutes(): number {
    const parsed = Number(
      this.config.get<string>('PASSWORD_RESET_TTL_MINUTES'),
    );

    return Number.isInteger(parsed) && parsed > 0
      ? parsed
      : DEFAULT_TTL_MINUTES;
  }
}
