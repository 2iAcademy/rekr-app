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
      select: { id: true, userType: true, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('This account no longer exists.');
    }

    if (!user.isActive) {
      throw new ForbiddenException('This account is inactive.');
    }

    return { id: user.id, userType: user.userType };
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
