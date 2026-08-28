import type { UserRole, UserType } from '../../generated/prisma/client';

/** Request metadata stored alongside a session, for tracing only. It never
 * takes part in an authorisation decision: a roaming mobile client changes IP
 * mid-session and must not be logged out for it. */
export interface SessionContext {
  userAgent?: string;
  ip?: string;
}

/** A freshly minted refresh token. `token` is the only place the plaintext
 * ever exists — the database holds its SHA-256 and nothing else. */
export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
  familyId: string;
}

export interface PublicUser {
  id: number;
  email: string;
  role: UserRole;
  userType: UserType;
  isActive: boolean;
  /** Whether the profile matching `userType` exists. The client gates the
   * onboarding on it, so it travels with the session rather than costing a
   * round trip of its own on every boot. */
  hasProfile: boolean;
}

export interface Session {
  accessToken: string;
  user: PublicUser;
  refreshToken: IssuedRefreshToken;
}
