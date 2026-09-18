import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RefreshTokenService } from './refresh-token.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
  compare: jest.fn().mockResolvedValue(false),
}));

const compareMock = bcrypt.compare as unknown as jest.Mock;

interface TestContext {
  service: AuthService;
  prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };
  refreshTokens: {
    issue: jest.Mock;
    findByToken: jest.Mock;
    rotate: jest.Mock;
    replaySuccessor: jest.Mock;
    revokeById: jest.Mock;
    revokeFamily: jest.Mock;
  };
}

async function createTestContext(): Promise<TestContext> {
  const prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };
  const refreshTokens = {
    issue: jest.fn().mockResolvedValue({
      token: 'raw-refresh',
      expiresAt: new Date(Date.now() + 86_400_000),
      familyId: '11111111-1111-4111-8111-111111111111',
    }),
    findByToken: jest.fn(),
    rotate: jest.fn().mockResolvedValue({
      token: 'rotated-refresh',
      expiresAt: new Date(Date.now() + 86_400_000),
      familyId: '11111111-1111-4111-8111-111111111111',
    }),
    replaySuccessor: jest.fn().mockResolvedValue(null),
    revokeById: jest.fn(),
    revokeFamily: jest.fn(),
  };

  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: PrismaService, useValue: prisma },
      { provide: JwtService, useValue: { sign: jest.fn(() => 'token') } },
      { provide: RefreshTokenService, useValue: refreshTokens },
    ],
  }).compile();

  return { service: moduleRef.get(AuthService), prisma, refreshTokens };
}

describe('AuthService.login — enumeration hardening', () => {
  let service: AuthService;
  let prisma: TestContext['prisma'];
  let refreshTokens: TestContext['refreshTokens'];

  beforeEach(async () => {
    compareMock.mockClear();
    ({ service, prisma, refreshTokens } = await createTestContext());
  });

  /**
   * The timing oracle: returning early on an unknown e-mail answers in a few
   * milliseconds, while a known e-mail pays a full bcrypt round. The identical
   * 401 body hides nothing if the response time gives the answer away.
   */
  it('still spends a bcrypt comparison when the e-mail is unknown', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'ghost@test.dev', password: 'whatever' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(compareMock).toHaveBeenCalledTimes(1);
    // The compared value is the SHA-256 pre-hash, not the raw password — the
    // decoy path must fold the input exactly like the real one, otherwise the
    // two branches would not cost the same and the oracle would reopen.
    expect(compareMock).toHaveBeenCalledWith(
      createHash('sha256').update('whatever', 'utf8').digest('base64'),
      expect.stringMatching(/^\$2[aby]\$/),
    );
  });

  it('returns the same error as a wrong password on an existing account', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'known@test.dev',
      passwordHash: 'stored',
      isActive: true,
    });

    const known = await service
      .login({ email: 'known@test.dev', password: 'wrong' }, {})
      .catch((error: UnauthorizedException) => error);
    prisma.user.findUnique.mockResolvedValue(null);
    const unknown = await service
      .login({ email: 'ghost@test.dev', password: 'wrong' }, {})
      .catch((error: UnauthorizedException) => error);

    expect((known as UnauthorizedException).message).toBe(
      (unknown as UnauthorizedException).message,
    );
  });

  it('issues a refresh token alongside the access token on login', async () => {
    compareMock.mockResolvedValueOnce(true);
    prisma.user.findUnique.mockResolvedValue({
      id: 42,
      email: 'known@test.dev',
      passwordHash: 'stored',
      isActive: true,
      role: 'user',
      userType: 'candidate',
    });

    const session = await service.login(
      { email: 'known@test.dev', password: 'right' },
      { ip: '10.0.0.1' },
    );

    expect(refreshTokens.issue).toHaveBeenCalledWith(42, { ip: '10.0.0.1' });
    expect(session.refreshToken.token).toBe('raw-refresh');
    expect(session.accessToken).toBe('token');
  });

  /** Signup opens a session exactly like login does. Asserted separately so
   * that the two paths diverging later cannot go unnoticed. */
  it('issues a refresh token alongside the access token on signup', async () => {
    prisma.user.create.mockResolvedValue({
      id: 43,
      email: 'new@test.dev',
      passwordHash: 'stored',
      isActive: true,
      role: 'user',
      userType: 'candidate',
    });

    const session = await service.signup(
      {
        email: 'new@test.dev',
        password: 'Sup3rSecret!',
        userType: 'candidate',
      },
      { ip: '10.0.0.2' },
    );

    expect(refreshTokens.issue).toHaveBeenCalledWith(43, { ip: '10.0.0.2' });
    expect(session.refreshToken.token).toBe('raw-refresh');
  });
});

describe('AuthService.refresh', () => {
  let service: AuthService;
  let prisma: TestContext['prisma'];
  let refreshTokens: TestContext['refreshTokens'];

  beforeEach(async () => {
    ({ service, prisma, refreshTokens } = await createTestContext());
  });

  const FAMILY = '11111111-1111-4111-8111-111111111111';

  const liveRow = {
    id: 7,
    userId: 42,
    familyId: FAMILY,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 86_400_000),
  };

  const activeUser = {
    id: 42,
    email: 'known@test.dev',
    isActive: true,
    role: 'user',
    userType: 'candidate',
  };

  it('rejects a missing cookie', async () => {
    await expect(service.refresh(undefined, {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an unknown token', async () => {
    refreshTokens.findByToken.mockResolvedValue(null);

    await expect(service.refresh('ghost', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(refreshTokens.revokeFamily).not.toHaveBeenCalled();
  });

  it('rejects an expired token without touching the family', async () => {
    refreshTokens.findByToken.mockResolvedValue({
      ...liveRow,
      expiresAt: new Date(Date.now() - 1),
    });

    await expect(service.refresh('stale', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(refreshTokens.revokeFamily).not.toHaveBeenCalled();
  });

  /** The reuse alarm: a revoked token with nothing replayable behind it means
   * the plaintext leaked, because the legitimate client moved on to its
   * successor and would never send this one again. */
  it('revokes the whole family when a revoked token has no replayable successor', async () => {
    refreshTokens.findByToken.mockResolvedValue({
      ...liveRow,
      revokedAt: new Date(Date.now() - 60_000),
    });

    await expect(service.refresh('replayed', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(refreshTokens.revokeFamily).toHaveBeenCalledWith(FAMILY);
  });

  /**
   * Two tabs hitting a 401 at the same instant both send the old cookie. The
   * loser must not be mistaken for an intruder — that would destroy a
   * legitimate session with the very mechanism meant to protect it. It gets
   * the successor the winner already minted, so the family keeps one branch.
   */
  it('serves the recorded successor instead of rotating a second time', async () => {
    refreshTokens.findByToken.mockResolvedValue({
      ...liveRow,
      revokedAt: new Date(Date.now() - 2_000),
    });
    refreshTokens.replaySuccessor.mockResolvedValue({
      token: 'the-successor',
      expiresAt: new Date(Date.now() + 86_400_000),
      familyId: FAMILY,
    });
    prisma.user.findUnique.mockResolvedValue(activeUser);

    const session = await service.refresh('raced', {});

    expect(refreshTokens.revokeFamily).not.toHaveBeenCalled();
    expect(refreshTokens.rotate).not.toHaveBeenCalled();
    expect(session.refreshToken.token).toBe('the-successor');
  });

  /** Reuse is decided before the account is even loaded: a leaked token has to
   * cut the session whatever the state of the account behind it. */
  it('detects reuse on an account that no longer exists', async () => {
    refreshTokens.findByToken.mockResolvedValue({
      ...liveRow,
      revokedAt: new Date(Date.now() - 60_000),
    });
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.refresh('replayed', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(refreshTokens.revokeFamily).toHaveBeenCalledWith(FAMILY);
  });

  /** Losing the compare-and-swap to a link holding nothing replayable — a
   * concurrent logout, a family cut in between — is reuse all the same. */
  it('revokes the family when the rotation loses to a dead link', async () => {
    refreshTokens.findByToken.mockResolvedValue(liveRow);
    prisma.user.findUnique.mockResolvedValue(activeUser);
    refreshTokens.rotate.mockResolvedValue(null);

    await expect(service.refresh('valid', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(refreshTokens.revokeFamily).toHaveBeenCalledWith(FAMILY);
  });

  it('refuses a deactivated account with 403', async () => {
    refreshTokens.findByToken.mockResolvedValue(liveRow);
    prisma.user.findUnique.mockResolvedValue({
      ...activeUser,
      isActive: false,
    });

    await expect(service.refresh('valid', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns a fresh access token and rotates on the happy path', async () => {
    refreshTokens.findByToken.mockResolvedValue(liveRow);
    prisma.user.findUnique.mockResolvedValue(activeUser);

    const session = await service.refresh('valid', { ip: '10.0.0.1' });

    expect(refreshTokens.rotate).toHaveBeenCalledWith(liveRow, 'valid', {
      ip: '10.0.0.1',
    });
    expect(session.accessToken).toBe('token');
    expect(session.user.id).toBe(42);
    expect(session.refreshToken.token).toBe('rotated-refresh');
  });
});

describe('AuthService.logout', () => {
  let service: AuthService;
  let refreshTokens: TestContext['refreshTokens'];

  beforeEach(async () => {
    ({ service, refreshTokens } = await createTestContext());
  });

  it('revokes only the presented session', async () => {
    refreshTokens.findByToken.mockResolvedValue({
      id: 7,
      userId: 42,
      familyId: '11111111-1111-4111-8111-111111111111',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await service.logout('valid');

    expect(refreshTokens.revokeById).toHaveBeenCalledWith(7);
    expect(refreshTokens.revokeFamily).not.toHaveBeenCalled();
  });

  /** Answering differently on an unknown token would tell a caller whether a
   * given string is a live session — an enumeration oracle for free. */
  it('stays silent on an unknown token', async () => {
    refreshTokens.findByToken.mockResolvedValue(null);

    await expect(service.logout('ghost')).resolves.toBeUndefined();
    expect(refreshTokens.revokeById).not.toHaveBeenCalled();
  });

  it('stays silent when no cookie was sent', async () => {
    await expect(service.logout(undefined)).resolves.toBeUndefined();
    expect(refreshTokens.findByToken).not.toHaveBeenCalled();
  });

  /** Signing out twice is not an error, and re-revoking a dead row would be a
   * write for nothing. */
  it('stays silent on an already revoked token', async () => {
    refreshTokens.findByToken.mockResolvedValue({
      id: 7,
      userId: 42,
      familyId: '11111111-1111-4111-8111-111111111111',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await expect(service.logout('already-dead')).resolves.toBeUndefined();
    expect(refreshTokens.revokeById).not.toHaveBeenCalled();
  });
});

/**
 * The session has to answer "where does this user belong?" on its own. Without
 * it the client either sends everyone to the same screen — which is how a
 * recruiter ends up on the public splash right after signing in — or pays an
 * extra round trip on every boot to ask whether the onboarding is behind them.
 */
describe('AuthService — profile completion in the session', () => {
  let service: AuthService;
  let prisma: TestContext['prisma'];

  const CANDIDATE = {
    id: 42,
    email: 'camille@rekr.fr',
    passwordHash: 'hashed',
    userType: 'candidate',
    role: 'user',
    isActive: true,
  };

  const RECRUITER = { ...CANDIDATE, id: 43, userType: 'recruiter' };

  beforeEach(async () => {
    compareMock.mockClear();
    compareMock.mockResolvedValue(true);
    ({ service, prisma } = await createTestContext());
  });

  it('reports a candidate who never finished the onboarding as profile-less', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...CANDIDATE,
      candidateProfile: null,
      recruiterProfile: null,
    });

    const session = await service.login(
      { email: CANDIDATE.email, password: 'whatever' },
      {},
    );

    expect(session.user.hasProfile).toBe(false);
  });

  it('reports a candidate who owns a profile as onboarded', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...CANDIDATE,
      candidateProfile: { id: 7 },
      recruiterProfile: null,
    });

    const session = await service.login(
      { email: CANDIDATE.email, password: 'whatever' },
      {},
    );

    expect(session.user.hasProfile).toBe(true);
  });

  it('reports a recruiter who owns a profile as onboarded', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...RECRUITER,
      candidateProfile: null,
      recruiterProfile: { id: 9 },
    });

    const session = await service.login(
      { email: RECRUITER.email, password: 'whatever' },
      {},
    );

    expect(session.user.hasProfile).toBe(true);
  });

  /**
   * The two profile tables are unrelated, and nothing in the schema forbids a
   * row in the wrong one. Reading whichever exists would let a candidate row
   * hanging off a recruiter account pass the onboarding gate, so the answer has
   * to follow the account's own type.
   */
  it('ignores a profile that does not belong to the account type', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...RECRUITER,
      candidateProfile: { id: 7 },
      recruiterProfile: null,
    });

    const session = await service.login(
      { email: RECRUITER.email, password: 'whatever' },
      {},
    );

    expect(session.user.hasProfile).toBe(false);
  });

  /** A brand-new account has nothing behind it by construction. */
  it('reports a fresh signup as profile-less', async () => {
    prisma.user.create.mockResolvedValue(CANDIDATE);

    const session = await service.signup(
      { email: CANDIDATE.email, password: 'whatever', userType: 'candidate' },
      {},
    );

    expect(session.user.hasProfile).toBe(false);
  });

  /**
   * A reload goes through `refresh`, and completing the onboarding in another
   * tab has to be visible after it — otherwise the gate would send an onboarded
   * user back to the wizard for the rest of the session.
   */
  it('reports completion through a refresh', async () => {
    const {
      service: refreshService,
      prisma: refreshPrisma,
      refreshTokens,
    } = await createTestContext();

    refreshTokens.findByToken.mockResolvedValue({
      id: 7,
      userId: CANDIDATE.id,
      familyId: '11111111-1111-4111-8111-111111111111',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    refreshPrisma.user.findUnique.mockResolvedValue({
      ...CANDIDATE,
      candidateProfile: { id: 7 },
      recruiterProfile: null,
    });

    const session = await refreshService.refresh('valid', {});

    expect(session.user.hasProfile).toBe(true);
  });

  it('reports completion through /me', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...CANDIDATE,
      candidateProfile: { id: 7 },
      recruiterProfile: null,
    });

    await expect(service.me(CANDIDATE.id)).resolves.toMatchObject({
      hasProfile: true,
    });
  });
});
