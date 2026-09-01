import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserType } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './auth-user.interface';
import { JwtPayload } from './jwt-payload.interface';

const USER_TYPES = Object.values(UserType) as string[];

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string>; user?: AuthUser }>();

    const token = JwtAuthGuard.extractBearerToken(
      request.headers.authorization,
    );
    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }

    request.user = await this.resolveCurrentUser(payload);
    return true;
  }

  private async resolveCurrentUser(payload: JwtPayload): Promise<AuthUser> {
    const id = JwtAuthGuard.readSubject(payload);

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        userType: true,
        isActive: true,
        passwordChangedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('This account no longer exists.');
    }

    if (!user.isActive) {
      throw new ForbiddenException('This account is inactive.');
    }

    if (JwtAuthGuard.predatesPasswordChange(payload, user.passwordChangedAt)) {
      throw new UnauthorizedException(
        'This token was issued before the password changed.',
      );
    }

    return { id: user.id, userType: user.userType };
  }

  /**
   * What makes a password reset end the sessions already running. Revoking the
   * refresh tokens only stops them being renewed; the access token in the
   * client's hands is stateless and stays verifiable for its whole window.
   *
   * The two clocks do not have the same resolution: `iat` is the issue instant
   * floored to the second, `passwordChangedAt` is millisecond-precise.
   * Comparing them as they are would refuse a token minted 300 ms after the
   * change, whose `iat` still points at the second before it — a user who
   * logs in immediately after resetting, locked out. So both sides are floored
   * to the second and compared strictly.
   *
   * The tie that leaves is decided in the token's favour: one issued earlier in
   * the same second as the change survives until the second ends. Refusing it
   * instead would mean refusing legitimate tokens minted in that same second,
   * which is the more likely of the two and the more damaging. The residual
   * window is under a second and only reachable by a holder whose token was
   * already valid at that instant.
   *
   * A NULL stamp — every account whose password predates the column — refuses
   * nothing.
   */
  private static predatesPasswordChange(
    payload: JwtPayload,
    passwordChangedAt: Date | null,
  ): boolean {
    if (!passwordChangedAt) {
      return false;
    }

    if (typeof payload.iat !== 'number') {
      return true;
    }

    return payload.iat < Math.floor(passwordChangedAt.getTime() / 1000);
  }

  private static extractBearerToken(header?: string): string | null {
    const [scheme, token] = header?.split(' ') ?? [];
    return scheme?.toLowerCase() === 'bearer' && token ? token : null;
  }

  private static readSubject(payload: JwtPayload): number {
    const id = Number(payload.sub);
    if (!Number.isInteger(id) || id <= 0) {
      throw new UnauthorizedException('Invalid token subject.');
    }

    if (!payload.userType || !USER_TYPES.includes(payload.userType)) {
      throw new UnauthorizedException('Invalid token user type.');
    }

    return id;
  }
}
