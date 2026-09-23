import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserType } from '../../generated/prisma/client';
import { AuthUser } from './auth-user.interface';
import { ANY_AUTHENTICATED_USER_KEY, ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * A handler this guard protects but that names no role is refused, not
   * served.
   *
   * The opposite default let an undecorated handler through to every
   * authenticated caller. Nothing exploited it — every handler behind this
   * guard carries its own `@Roles` — but the failure mode pointed the wrong
   * way: forgetting a decorator opened a route instead of closing it, and the
   * mistake produced no symptom at all. Refusing instead makes the omission
   * cost a 403 on the first call, which is noticed.
   *
   * Widening a whole controller is not the fix for that, and is plainly wrong
   * where the handlers of one controller do not share a role. A route that
   * genuinely serves every user type says so with `@AnyAuthenticatedUser`.
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!request.user) {
      throw new ForbiddenException();
    }

    return this.isAllowed(context, request.user.userType);
  }

  /**
   * The handler is consulted whole before the controller, rather than each
   * decorator being resolved on its own across both levels: the two say the
   * same kind of thing, so whichever the handler declares has to win over
   * whatever the class declares — including a method `@Roles` narrowing a
   * controller marked open to everyone.
   */
  private isAllowed(context: ExecutionContext, userType: UserType): boolean {
    for (const target of [context.getHandler(), context.getClass()]) {
      if (
        this.reflector.get<boolean | undefined>(
          ANY_AUTHENTICATED_USER_KEY,
          target,
        )
      ) {
        return true;
      }

      const roles = this.reflector.get<UserType[] | undefined>(
        ROLES_KEY,
        target,
      );
      if (roles) {
        if (roles.includes(userType)) {
          return true;
        }
        throw new ForbiddenException();
      }
    }

    throw new ForbiddenException();
  }
}
