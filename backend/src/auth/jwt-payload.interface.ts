import { UserType } from '../../generated/prisma/client';

/**
 * Deliberately minimal. A JWT payload is signed, not encrypted: it rides in
 * clear base64url on every request and lands in logs, proxies and browser
 * storage.
 *
 * `email` was personal data that no code path read. `role` was worse — a
 * privilege claim frozen at issue time, which invites trusting the token over
 * the database. Authorisation reads `userType` and `isActive` from the database
 * on every request (see `JwtAuthGuard.resolveCurrentUser`), so a revoked or
 * downgraded account loses access immediately instead of at token expiry.
 */
export interface JwtPayload {
  sub: string;
  userType: UserType;
}
