import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { AuthUser } from './auth-user.interface';

const contextOf = (user?: AuthUser): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  const guardWithRequiredRoles = (roles?: string[]) => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);
    return new RolesGuard(reflector);
  };

  it('allows a route that declares no role', () => {
    expect(
      guardWithRequiredRoles(undefined).canActivate(
        contextOf({ id: 1, userType: 'candidate' }),
      ),
    ).toBe(true);
  });

  it('allows a user whose type matches the required role', () => {
    expect(
      guardWithRequiredRoles(['recruiter']).canActivate(
        contextOf({ id: 1, userType: 'recruiter' }),
      ),
    ).toBe(true);
  });

  it('forbids a user whose type does not match', () => {
    expect(() =>
      guardWithRequiredRoles(['recruiter']).canActivate(
        contextOf({ id: 1, userType: 'candidate' }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('forbids an unauthenticated request on a role-protected route', () => {
    expect(() =>
      guardWithRequiredRoles(['recruiter']).canActivate(contextOf(undefined)),
    ).toThrow(ForbiddenException);
  });
});
