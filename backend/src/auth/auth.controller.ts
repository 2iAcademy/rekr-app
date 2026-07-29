import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ThrottleScope } from '../common/throttling/throttle-scope.decorator';
import type { AuthUser } from './auth-user.interface';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookie,
  setRefreshCookie,
} from './refresh-cookie';
import type { Session, SessionContext } from './session.interface';

const sessionContextOf = (req: Request): SessionContext => ({
  userAgent: req.get('user-agent') ?? undefined,
  ip: req.ip,
});

const refreshTokenOf = (req: Request): string | undefined =>
  (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE_NAME];

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ThrottleScope('signup')
  async signup(
    @Body() signupDto: SignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.authService.signup(
      signupDto,
      sessionContextOf(req),
    );

    return this.respondWithSession(session, res);
  }

  @Post('login')
  @HttpCode(200)
  @ThrottleScope('login')
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.authService.login(
      loginDto,
      sessionContextOf(req),
    );

    return this.respondWithSession(session, res);
  }

  /**
   * Deliberately outside `JwtAuthGuard`: this route has to work precisely when
   * the access token is dead. The cookie is its authentication.
   */
  @Post('refresh')
  @HttpCode(200)
  @ThrottleScope('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.authService.refresh(
      refreshTokenOf(req),
      sessionContextOf(req),
    );

    return this.respondWithSession(session, res);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(refreshTokenOf(req));
    clearRefreshCookie(res);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }

  /** The refresh token leaves in the cookie and nowhere else — never in the
   * body, which JavaScript could read. */
  private respondWithSession(session: Session, res: Response) {
    setRefreshCookie(res, session.refreshToken);

    return { accessToken: session.accessToken, user: session.user };
  }
}
