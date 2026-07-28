import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { RefreshTokenService } from './refresh-token.service';
import type { PublicUser, Session, SessionContext } from './session.interface';

@Injectable()
export class AuthService {
  private static readonly PASSWORD_SALT_ROUNDS = 12;

  /**
   * bcrypt hash of a random string nobody holds, compared against when the
   * e-mail is unknown.
   *
   * Without it, login answers in ~5 ms for an unknown account and in ~300 ms
   * for a known one (bcrypt at cost 12). That two-orders-of-magnitude gap is a
   * clean enumeration oracle, and the identical 401 message does nothing to
   * hide it. Burning the same work on both paths closes it.
   */
  private static readonly ABSENT_USER_PASSWORD_HASH =
    '$2b$12$MZxXVW/XR9uj2mAONxbcu.p6v6Dpln76RdV9eDQtwOS6w66dTe3l2';

  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  /**
   * bcrypt only hashes the first 72 bytes of its input and drops the rest
   * without raising: two passwords sharing a 72-byte prefix would open the same
   * account, and a long passphrase would be silently cut down. Folding the
   * password into a fixed-size digest first removes the ceiling entirely
   * instead of making the user carry it.
   *
   * The digest is base64-encoded, never passed as raw bytes: bcrypt treats a
   * NUL byte as end-of-string, so a binary digest containing one would truncate
   * the effective secret to whatever precedes it.
   */
  private static preHashPassword(password: string): string {
    return createHash('sha256').update(password, 'utf8').digest('base64');
  }

  async signup(
    signupDto: SignupDto,
    context: SessionContext,
  ): Promise<Session> {
    const passwordHash = await bcrypt.hash(
      AuthService.preHashPassword(signupDto.password),
      AuthService.PASSWORD_SALT_ROUNDS,
    );

    let user: User;
    try {
      user = await this.prismaService.user.create({
        data: {
          email: signupDto.email,
          passwordHash,
          userType: signupDto.userType,
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account already exists for this email.',
        );
      }
      throw error;
    }

    return this.buildSession(user, context);
  }

  async login(loginDto: LoginDto, context: SessionContext): Promise<Session> {
    const user = await this.prismaService.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      await bcrypt.compare(
        AuthService.preHashPassword(loginDto.password),
        AuthService.ABSENT_USER_PASSWORD_HASH,
      );
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isPasswordValid = await bcrypt.compare(
      AuthService.preHashPassword(loginDto.password),
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.isActive) {
      throw new ForbiddenException('This account is inactive.');
    }

    return this.buildSession(user, context);
  }

  async refresh(
    rawToken: string | undefined,
    context: SessionContext,
  ): Promise<Session> {
    if (!rawToken) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const stored = await this.refreshTokens.findByToken(rawToken);
    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    // An already-revoked row is either a repeat of a rotation that just
    // happened — two tabs, a retried request — in which case the successor it
    // recorded is served again, or it is a token that leaked, because the
    // legitimate client moved on and would never send this one. Asked before
    // any account check, so a leak still cuts the session on an account that
    // has meanwhile been deactivated.
    const replayed = stored.revokedAt
      ? await this.refreshTokens.replaySuccessor(stored, rawToken)
      : null;

    if (stored.revokedAt && !replayed) {
      return this.rejectAsReuse(stored.familyId);
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: stored.userId },
    });

    if (!user) {
      throw new UnauthorizedException('This account no longer exists.');
    }

    if (!user.isActive) {
      throw new ForbiddenException('This account is inactive.');
    }

    // A replay serves the successor already minted; only a live token rotates.
    // `rotate` returns null when it lost the compare-and-swap to a link that
    // holds nothing replayable — a concurrent logout, or a family already cut.
    const refreshToken =
      replayed ?? (await this.refreshTokens.rotate(stored, rawToken, context));

    if (!refreshToken) {
      return this.rejectAsReuse(stored.familyId);
    }

    return {
      accessToken: this.signAccessToken(user),
      user: this.toPublicUser(user),
      refreshToken,
    };
  }

  /** Cut the entire session, not just the link presented — whoever leaked this
   * token may hold its successor too. */
  private async rejectAsReuse(familyId: string): Promise<never> {
    await this.refreshTokens.revokeFamily(familyId);

    throw new UnauthorizedException('Invalid refresh token.');
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }

    const stored = await this.refreshTokens.findByToken(rawToken);
    if (!stored || stored.revokedAt) {
      return;
    }

    await this.refreshTokens.revokeById(stored.id);
  }

  async me(userId: number) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('This account no longer exists.');
    }

    if (!user.isActive) {
      throw new ForbiddenException('This account is inactive.');
    }

    return this.toPublicUser(user);
  }

  private async buildSession(
    user: User,
    context: SessionContext,
  ): Promise<Session> {
    return {
      accessToken: this.signAccessToken(user),
      user: this.toPublicUser(user),
      refreshToken: await this.refreshTokens.issue(user.id, context),
    };
  }

  private signAccessToken(user: User): string {
    return this.jwtService.sign(
      { userType: user.userType },
      { subject: String(user.id) },
    );
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      userType: user.userType,
      isActive: user.isActive,
    };
  }
}
