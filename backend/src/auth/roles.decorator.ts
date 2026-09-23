import { SetMetadata } from '@nestjs/common';
import { UserType } from '../../generated/prisma/client';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserType[]) => SetMetadata(ROLES_KEY, roles);

export const ANY_AUTHENTICATED_USER_KEY = 'anyAuthenticatedUser';

/**
 * The counterpart of `RolesGuard` refusing what it cannot classify: the way to
 * say "any authenticated user, on purpose".
 *
 * It exists so that the alternative is never taken. Spelling the same thing as
 * `@Roles('candidate', 'recruiter', 'admin')` would read as a deliberate list
 * of three types, and would silently stop covering the route the day a fourth
 * user type is added to the schema. This says what is meant instead, and keeps
 * saying it.
 */
export const AnyAuthenticatedUser = () =>
  SetMetadata(ANY_AUTHENTICATED_USER_KEY, true);
