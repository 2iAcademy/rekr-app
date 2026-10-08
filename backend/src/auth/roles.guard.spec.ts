import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { AuthUser } from './auth-user.interface';
import { AnyAuthenticatedUser, Roles } from './roles.decorator';

type ControllerClass = abstract new () => object;

/**
 * Real `Reflector`, real decorators, real classes. Stubbing
 * `getAllAndOverride` would assert what the guard does with a list of roles,
 * never how that list is resolved — and the method-over-class override is
 * precisely the part worth freezing.
 */
const contextFor = (
  controller: ControllerClass,
  handlerName: string,
  user?: AuthUser,
): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () =>
      (controller.prototype as Record<string, unknown>)[handlerName],
    getClass: () => controller,
  }) as unknown as ExecutionContext;

class UndecoratedController {
  open() {}
}

class MethodScopedController {
  @Roles('recruiter')
  restricted() {}

  @Roles()
  emptyList() {}

  @AnyAuthenticatedUser()
  anyone() {}
}

@Roles('recruiter')
class ClassScopedController {
  inherited() {}

  @Roles('candidate')
  overridden() {}
}

@Roles('recruiter')
class ClassScopedOpenController {
  @AnyAuthenticatedUser()
  anyone() {}
}

const candidate: AuthUser = { id: 1, userType: 'candidate' };
const recruiter: AuthUser = { id: 2, userType: 'recruiter' };
const admin: AuthUser = { id: 3, userType: 'admin' };

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  describe('a handler with no role resolved', () => {
    it('refuses it even for an authenticated user', () => {
      expect(() =>
        guard.canActivate(contextFor(UndecoratedController, 'open', candidate)),
      ).toThrow(ForbiddenException);
    });

    it('refuses an empty @Roles() just as firmly', () => {
      expect(() =>
        guard.canActivate(
          contextFor(MethodScopedController, 'emptyList', recruiter),
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('method-level @Roles', () => {
    it('allows a matching user type', () => {
      expect(
        guard.canActivate(
          contextFor(MethodScopedController, 'restricted', recruiter),
        ),
      ).toBe(true);
    });

    it('forbids a user type that does not match', () => {
      expect(() =>
        guard.canActivate(
          contextFor(MethodScopedController, 'restricted', candidate),
        ),
      ).toThrow(ForbiddenException);
    });

    it('forbids a request carrying no user', () => {
      expect(() =>
        guard.canActivate(
          contextFor(MethodScopedController, 'restricted', undefined),
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('class-level @Roles', () => {
    it('covers a handler that declares none of its own', () => {
      expect(
        guard.canActivate(
          contextFor(ClassScopedController, 'inherited', recruiter),
        ),
      ).toBe(true);
    });

    it('forbids a user type outside the class role', () => {
      expect(() =>
        guard.canActivate(
          contextFor(ClassScopedController, 'inherited', candidate),
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('method-level @Roles overrides the class', () => {
    it('allows the method role even when the class excludes it', () => {
      expect(
        guard.canActivate(
          contextFor(ClassScopedController, 'overridden', candidate),
        ),
      ).toBe(true);
    });

    it('forbids the class role once the method narrowed it', () => {
      expect(() =>
        guard.canActivate(
          contextFor(ClassScopedController, 'overridden', recruiter),
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('@AnyAuthenticatedUser', () => {
    it('lets every user type through', () => {
      for (const user of [candidate, recruiter, admin]) {
        expect(
          guard.canActivate(contextFor(MethodScopedController, 'anyone', user)),
        ).toBe(true);
      }
    });

    it('still refuses a request carrying no user', () => {
      expect(() =>
        guard.canActivate(
          contextFor(MethodScopedController, 'anyone', undefined),
        ),
      ).toThrow(ForbiddenException);
    });

    it('widens a class-level @Roles rather than being shadowed by it', () => {
      expect(
        guard.canActivate(
          contextFor(ClassScopedOpenController, 'anyone', candidate),
        ),
      ).toBe(true);
    });
  });
});
