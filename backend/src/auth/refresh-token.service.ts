import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Prisma, RefreshToken } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { IssuedRefreshToken, SessionContext } from './session.interface';
import { seal, unseal } from './successor-seal';

type PrismaWriter = PrismaService | Prisma.TransactionClient;

const TOKEN_BYTES = 32;
const USER_AGENT_MAX_LENGTH = 255;
const DEFAULT_TTL_DAYS = 30;
const DEFAULT_REPLAY_SECONDS = 10;

/**
 * A chain only grows by one link per rotation landing inside the replay window,
 * so in practice it is one hop — two tabs racing. The bound exists so that a
 * malformed chain costs a fixed number of queries instead of an open loop.
 */
const MAX_REPLAY_HOPS = 4;

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * SHA-256 rather than bcrypt, which is the opposite of what the password
   * column does — deliberately. bcrypt salts each entry, which rules out any
   * indexed lookup, and we must find the row *from* the presented token. Its
   * cost also exists to slow a dictionary attack against a low-entropy secret;
   * this one is 256 bits of cryptographic randomness, so there is no dictionary
   * to walk. What matters is preserved: a database dump yields no usable
   * session.
   */
  static hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  getTtlMs(): number {
    return (
      this.readPositiveInt('REFRESH_TOKEN_TTL_DAYS', DEFAULT_TTL_DAYS) *
      86_400_000
    );
  }

  /**
   * How long a rotated token still answers with its successor. This is not a
   * grace period in the sense of forgiving a suspicious act: nothing is
   * forgiven and no second session is opened, the same successor is simply
   * served again. Which is why the window can stay short without ever
   * disconnecting a legitimate client.
   */
  getReplayWindowMs(): number {
    return (
      this.readPositiveInt(
        'REFRESH_TOKEN_REPLAY_SECONDS',
        DEFAULT_REPLAY_SECONDS,
      ) * 1_000
    );
  }

  async issue(
    userId: number,
    context: SessionContext,
  ): Promise<IssuedRefreshToken> {
    const issued = this.mint(randomUUID());

    return this.persist(this.prisma, userId, issued, context);
  }

  async findByToken(token: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash: RefreshTokenService.hash(token) },
    });
  }

  /**
   * Compare-and-swap: the row is claimed by an UPDATE guarded on
   * `revoked_at IS NULL`, and the successor is sealed onto it in that same
   * statement. Under Postgres READ COMMITTED a concurrent writer blocks on the
   * row lock, re-evaluates the predicate once the winner commits, and matches
   * nothing — so exactly one caller ever mints a successor.
   *
   * The loser is not turned away. It re-reads the row and replays the token
   * the winner just sealed there, so both callers leave with the same
   * successor and the family keeps a single live branch. Null means the row it
   * lost to holds nothing replayable, which is reuse.
   */
  async rotate(
    current: RefreshToken,
    rawToken: string,
    context: SessionContext,
  ): Promise<IssuedRefreshToken | null> {
    const successor = this.mint(current.familyId);

    const claimed = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id: current.id, revokedAt: null },
        data: {
          revokedAt: new Date(),
          successorSealed: seal(successor.token, rawToken),
        },
      });

      if (count === 0) {
        return false;
      }

      await this.persist(tx, current.userId, successor, context);

      return true;
    });

    if (claimed) {
      return successor;
    }

    const reread = await this.prisma.refreshToken.findUnique({
      where: { id: current.id },
    });

    return reread ? this.replaySuccessor(reread, rawToken) : null;
  }

  /**
   * The successor a rotation sealed onto this row, if presenting the row again
   * is still a benign repeat rather than reuse. Null on every other reading,
   * and the caller treats null as theft.
   *
   * An empty `successorSealed` is the discriminant the design turns on: a
   * rotation always records its successor, while a logout and a family kill
   * revoke without recording anything. So the column says outright whether the
   * revocation was a handover or a death, instead of it being guessed from
   * whether some sibling happens to still be alive.
   */
  async replaySuccessor(
    row: RefreshToken,
    rawToken: string,
    hops = 0,
  ): Promise<IssuedRefreshToken | null> {
    if (hops >= MAX_REPLAY_HOPS || !row.revokedAt || !row.successorSealed) {
      return null;
    }

    if (Date.now() - row.revokedAt.getTime() > this.getReplayWindowMs()) {
      return null;
    }

    const successorToken = unseal(row.successorSealed, rawToken);
    if (!successorToken) {
      return null;
    }

    const successor = await this.findByToken(successorToken);
    if (!successor) {
      return null;
    }

    // Already rotated in turn: walk to the live end of the chain. Handing back
    // a revoked cookie would strand the caller, which only presents it again a
    // quarter of an hour later — by then outside the window, so read as theft.
    if (successor.revokedAt) {
      return this.replaySuccessor(successor, successorToken, hops + 1);
    }

    if (successor.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    // Served as it stands, expiry included: a replay must not slide the TTL, or
    // replaying on a loop would keep a session alive indefinitely.
    return {
      token: successorToken,
      expiresAt: successor.expiresAt,
      familyId: successor.familyId,
    };
  }

  async revokeById(id: number): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private mint(familyId: string): IssuedRefreshToken {
    return {
      token: randomBytes(TOKEN_BYTES).toString('base64url'),
      expiresAt: new Date(Date.now() + this.getTtlMs()),
      familyId,
    };
  }

  private async persist(
    client: PrismaWriter,
    userId: number,
    issued: IssuedRefreshToken,
    context: SessionContext,
  ): Promise<IssuedRefreshToken> {
    await client.refreshToken.create({
      data: {
        userId,
        tokenHash: RefreshTokenService.hash(issued.token),
        familyId: issued.familyId,
        expiresAt: issued.expiresAt,
        userAgent: context.userAgent?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
        ip: context.ip ?? null,
      },
    });

    return issued;
  }

  private readPositiveInt(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    const parsed = Number(raw);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
