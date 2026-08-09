import type { CookieOptions, Response } from 'express';
import type { IssuedRefreshToken } from './session.interface';

export const REFRESH_COOKIE_NAME = 'rekr_rt';

/**
 * Scoped to the four routes that read it, so the refresh token rides along with
 * no other API call and has that many fewer chances to land in a log or an APM
 * trace. This rules out the `__Host-` prefix, which mandates `path=/`.
 *
 * `sameSite: 'strict'` is what stands in for a CSRF token: the cookie is never
 * attached to a request a third-party site initiated, whatever the method. It
 * costs nothing here — no top-level navigation ever targets `/api/auth`.
 */
const BASE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  path: '/api/auth',
};

const secureFlag = (): boolean => process.env.NODE_ENV === 'production';

export function setRefreshCookie(
  res: Response,
  issued: IssuedRefreshToken,
): void {
  res.cookie(REFRESH_COOKIE_NAME, issued.token, {
    ...BASE_OPTIONS,
    secure: secureFlag(),
    expires: issued.expiresAt,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...BASE_OPTIONS,
    secure: secureFlag(),
  });
}
