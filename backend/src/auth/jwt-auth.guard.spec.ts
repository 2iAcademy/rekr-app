import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthUser } from './auth-user.interface';

type RequestMock = { headers: Record<string, string>; user?: AuthUser };

const contextOf = (request: RequestMock): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  const jwtService = new JwtService({ secret: 'test-secret' });
  let findUnique: jest.Mock;
  let guard: JwtAuthGuard;

  const activeUser = {
    id: 42,
    userType: 'recruiter',
    isActive: true,
    passwordChangedAt: null as Date | null,
  };

  beforeEach(() => {
    findUnique = jest.fn().mockResolvedValue(activeUser);
    guard = new JwtAuthGuard(jwtService, {
      user: { findUnique },
    } as unknown as PrismaService);
  });

  const signToken = (payload: object, subject: string) =>
    jwtService.sign(payload, { subject });

  /** `iat` is honoured when the payload already carries one, which is the only
   * way to place a token on either side of a password change from a test. */
  const tokenIssuedAt = (issuedAtSeconds: number) =>
    signToken({ userType: 'recruiter', iat: issuedAtSeconds }, '42');

  const validToken = () =>
    signToken(
      { email: 'a@test.dev', role: 'user', userType: 'recruiter' },
      '42',
    );

  const requestWith = (token: string): RequestMock => ({
    headers: { authorization: `Bearer ${token}` },
  });

  it('rejects a request without an Authorization header', async () => {
    await expect(guard.canActivate(contextOf({ headers: {} }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a non-Bearer authorization scheme', async () => {
    const request = { headers: { authorization: 'Basic abc' } };

    await expect(guard.canActivate(contextOf(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token signed with another secret', async () => {
    const foreign = new JwtService({ secret: 'another-secret' });
    const token = foreign.sign({ userType: 'candidate' }, { subject: '7' });

    await expect(
      guard.canActivate(contextOf(requestWith(token))),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an expired token', async () => {
    const token = jwtService.sign(
      { userType: 'candidate' },
      { subject: '7', expiresIn: '-1s' },
    );

    await expect(
      guard.canActivate(contextOf(requestWith(token))),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token whose subject is not a user id', async () => {
    const token = signToken({ userType: 'candidate' }, 'not-a-number');

    await expect(
      guard.canActivate(contextOf(requestWith(token))),
    ).rejects.toThrow(UnauthorizedException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects a token without a userType', async () => {
    const token = signToken({ email: 'a@test.dev' }, '7');

    await expect(
      guard.canActivate(contextOf(requestWith(token))),
    ).rejects.toThrow(UnauthorizedException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects a token whose user no longer exists', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      guard.canActivate(contextOf(requestWith(validToken()))),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('forbids a token whose user has been deactivated', async () => {
    findUnique.mockResolvedValue({ ...activeUser, isActive: false });

    await expect(
      guard.canActivate(contextOf(requestWith(validToken()))),
    ).rejects.toThrow(ForbiddenException);
  });

  it('trusts the database over the token for the user type', async () => {
    findUnique.mockResolvedValue({ ...activeUser, userType: 'candidate' });
    const request = requestWith(validToken());

    await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: 42, userType: 'candidate' });
  });

  it('refuses a token issued before the last password change', async () => {
    const changedAt = new Date();
    findUnique.mockResolvedValue({
      ...activeUser,
      passwordChangedAt: changedAt,
    });
    const token = tokenIssuedAt(Math.floor(changedAt.getTime() / 1000) - 1);

    await expect(
      guard.canActivate(contextOf(requestWith(token))),
    ).rejects.toThrow(UnauthorizedException);
  });

  /** The boundary the second-granularity of `iat` creates: a token minted just
   * after the change still reports the second the change happened in, and must
   * not be mistaken for one that predates it. */
  it('accepts a token issued in the same second as the password change', async () => {
    const changedAt = new Date(1_800_000_000_400);
    findUnique.mockResolvedValue({
      ...activeUser,
      passwordChangedAt: changedAt,
    });
    const token = tokenIssuedAt(1_800_000_000);

    await expect(
      guard.canActivate(contextOf(requestWith(token))),
    ).resolves.toBe(true);
  });

  it('refuses a token with no issue time once a password change is recorded', async () => {
    findUnique.mockResolvedValue({
      ...activeUser,
      passwordChangedAt: new Date(),
    });
    const token = jwtService.sign(
      { userType: 'recruiter' },
      { subject: '42', noTimestamp: true },
    );

    await expect(
      guard.canActivate(contextOf(requestWith(token))),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('refuses nothing on an account that has never changed its password', async () => {
    const token = tokenIssuedAt(1);

    await expect(
      guard.canActivate(contextOf(requestWith(token))),
    ).resolves.toBe(true);
  });

  it('accepts a valid token and exposes the current user on the request', async () => {
    const request = requestWith(validToken());

    await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: 42, userType: 'recruiter' });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 42 },
      select: {
        id: true,
        userType: true,
        isActive: true,
        passwordChangedAt: true,
      },
    });
  });
});
