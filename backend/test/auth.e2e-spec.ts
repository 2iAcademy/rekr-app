import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { httpRequest } from './http-client';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RefreshTokenService } from '../src/auth/refresh-token.service';
import { configureApp } from '../src/setup-app';
import { resetDb } from './reset-db';
import { resetThrottler } from './throttler-reset';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const signup = (email: string, userType: 'candidate' | 'recruiter') =>
    httpRequest(app)
      .post('/api/auth/signup')
      .send({ email, password: 'Sup3rSecret!', userType });

  const tokenOf = (res: request.Response): string =>
    (res.body as { accessToken: string }).accessToken;

  const cookiesOf = (res: request.Response): string[] =>
    (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];

  const refreshCookieOf = (res: request.Response): string => {
    const raw = cookiesOf(res).find((cookie) => cookie.startsWith('rekr_rt='));
    if (!raw) {
      throw new Error('No refresh cookie in response');
    }

    return raw.split(';')[0];
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(prisma);
    // 7 signups run in this file against a 10/min budget. Without this reset
    // the 11th one added here would fail with an unrelated-looking 429.
    resetThrottler(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects /auth/me without a token', async () => {
    await httpRequest(app).get('/api/auth/me').expect(401);
  });

  it('rejects /auth/me with a malformed token', async () => {
    await httpRequest(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401);
  });

  it('returns the current user for a token issued at signup', async () => {
    const created = await signup('candidate@test.dev', 'candidate');
    expect(created.status).toBe(201);

    const res = await httpRequest(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenOf(created)}`)
      .expect(200);

    expect(res.body).toEqual({
      id: expect.any(Number) as number,
      email: 'candidate@test.dev',
      role: 'user',
      userType: 'candidate',
      isActive: true,
    });
  });

  it('returns the current user for a token issued at login', async () => {
    await signup('recruiter@test.dev', 'recruiter').expect(201);

    const logged = await httpRequest(app)
      .post('/api/auth/login')
      .send({ email: 'recruiter@test.dev', password: 'Sup3rSecret!' })
      .expect(200);

    const res = await httpRequest(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenOf(logged)}`)
      .expect(200);

    expect(res.body).toMatchObject({
      email: 'recruiter@test.dev',
      userType: 'recruiter',
    });
  });

  it('never exposes the password hash', async () => {
    const created = await signup('candidate@test.dev', 'candidate');

    const res = await httpRequest(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenOf(created)}`)
      .expect(200);

    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('rejects a token whose user no longer exists', async () => {
    const created = await signup('ghost@test.dev', 'candidate');
    const token = tokenOf(created);
    await prisma.user.deleteMany();

    await httpRequest(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('rejects a token whose user has been deactivated', async () => {
    const created = await signup('inactive@test.dev', 'candidate');
    await prisma.user.updateMany({ data: { isActive: false } });

    await httpRequest(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenOf(created)}`)
      .expect(403);
  });

  it('rejects a deleted user on a business endpoint with 401, not 500', async () => {
    const created = await signup('ghost@test.dev', 'candidate');
    const token = tokenOf(created);
    await prisma.user.deleteMany();

    await httpRequest(app)
      .post('/api/candidate-profiles')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Ghost', lastName: 'User' })
      .expect(401);
  });

  it('forbids a deactivated user from writing on a business endpoint', async () => {
    const created = await signup('frozen@test.dev', 'candidate');
    await prisma.user.updateMany({ data: { isActive: false } });

    await httpRequest(app)
      .post('/api/candidate-profiles')
      .set('Authorization', `Bearer ${tokenOf(created)}`)
      .send({ firstName: 'Frozen', lastName: 'User' })
      .expect(403);
  });

  // L1 — a JWT payload is signed, not secret: it travels in clear base64url on
  // every request. `email` is personal data that nothing reads, and `role` is a
  // privilege claim frozen at issue time. Keeping the latter invites the next
  // developer to trust `payload.role` instead of the database, which is exactly
  // the mistake `resolveCurrentUser` already avoids for `userType`.
  it('signs no personal data and no stale privilege claim into the token', async () => {
    const created = await signup('claims@test.dev', 'candidate');
    const [, encodedPayload] = tokenOf(created).split('.');
    const claims = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;

    expect(claims).not.toHaveProperty('email');
    expect(claims).not.toHaveProperty('role');
    expect(claims.sub).toEqual(expect.any(String));
    expect(claims.userType).toBe('candidate');
  });

  // L2 — bcrypt hashes the first 72 *bytes* and drops the rest silently, so
  // without pre-hashing these two passwords open the same account. This is the
  // test that proves the SHA-256 pre-hash is actually wired in: it fails the
  // moment someone passes the raw password to bcrypt again.
  it('does not let a password sharing the first 72 bytes open the account', async () => {
    const password = 'a'.repeat(72);
    await httpRequest(app)
      .post('/api/auth/signup')
      .send({ email: 'prefix@test.dev', password, userType: 'candidate' })
      .expect(201);

    await httpRequest(app)
      .post('/api/auth/login')
      .send({
        email: 'prefix@test.dev',
        password: `${password}-DIFFERENT-TAIL`,
      })
      .expect(401);

    await httpRequest(app)
      .post('/api/auth/login')
      .send({ email: 'prefix@test.dev', password })
      .expect(200);
  });

  // Pre-hashing removes the 72-byte ceiling instead of making the user carry
  // it: a long passphrase is accepted in full and remains usable at login.
  it('accepts a password well beyond 72 bytes and keeps it usable', async () => {
    const password = `${'a'.repeat(200)}-tail`;
    await httpRequest(app)
      .post('/api/auth/signup')
      .send({ email: 'long@test.dev', password, userType: 'candidate' })
      .expect(201);

    await httpRequest(app)
      .post('/api/auth/login')
      .send({ email: 'long@test.dev', password })
      .expect(200);
  });

  // 40 accented characters are 80 bytes in UTF-8 — truncated before, accepted
  // whole now.
  it('accepts a multi-byte password whose byte length exceeds 72', async () => {
    const password = 'é'.repeat(40);
    await httpRequest(app)
      .post('/api/auth/signup')
      .send({ email: 'multibyte@test.dev', password, userType: 'candidate' })
      .expect(201);

    await httpRequest(app)
      .post('/api/auth/login')
      .send({ email: 'multibyte@test.dev', password })
      .expect(200);
  });

  // The ceiling is gone, not the bound: an absurd payload still has no reason
  // to reach the hashing function.
  it('still refuses an absurdly long password', async () => {
    await httpRequest(app)
      .post('/api/auth/signup')
      .send({
        email: 'absurd@test.dev',
        password: 'a'.repeat(5000),
        userType: 'candidate',
      })
      .expect(400);
  });

  describe('session lifecycle', () => {
    it('sets a hardened refresh cookie on login', async () => {
      await signup('cookie@test.dev', 'candidate');
      const res = await httpRequest(app)
        .post('/api/auth/login')
        .send({ email: 'cookie@test.dev', password: 'Sup3rSecret!' })
        .expect(200);

      const raw = cookiesOf(res).find((c) => c.startsWith('rekr_rt='));
      expect(raw).toContain('HttpOnly');
      expect(raw).toContain('SameSite=Strict');
      expect(raw).toContain('Path=/api/auth');
    });

    it('never puts the refresh token in the response body', async () => {
      const res = await signup('nobody@test.dev', 'candidate');

      expect(JSON.stringify(res.body)).not.toContain('rekr_rt');
      expect(res.body).not.toHaveProperty('refreshToken');
    });

    it('rejects a refresh with no cookie', async () => {
      await httpRequest(app).post('/api/auth/refresh').expect(401);
    });

    it('returns a working access token and a new cookie', async () => {
      const signed = await signup('rotate@test.dev', 'candidate');
      const first = refreshCookieOf(signed);

      const refreshed = await httpRequest(app)
        .post('/api/auth/refresh')
        .set('Cookie', first)
        .expect(200);

      expect(refreshCookieOf(refreshed)).not.toBe(first);

      await httpRequest(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokenOf(refreshed)}`)
        .expect(200);
    });

    /** The reuse alarm, end to end: replaying a rotated cookie must not only
     * fail, it must take the successor down with it. */
    it('kills the whole session when a rotated cookie is replayed', async () => {
      const signed = await signup('reuse@test.dev', 'candidate');
      const first = refreshCookieOf(signed);

      const rotated = await httpRequest(app)
        .post('/api/auth/refresh')
        .set('Cookie', first)
        .expect(200);
      const second = refreshCookieOf(rotated);

      // Beyond the grace window the replay is treated as theft.
      await new Promise((resolve) => setTimeout(resolve, 1_100));

      await httpRequest(app)
        .post('/api/auth/refresh')
        .set('Cookie', first)
        .expect(401);

      await httpRequest(app)
        .post('/api/auth/refresh')
        .set('Cookie', second)
        .expect(401);
    });

    /**
     * The contract the front is built against. Two refreshes carrying the same
     * live cookie used to answer 200 each and leave the family with two live
     * successors that nothing ever reconciled: reuse detection blind to the
     * fork, logout unable to close it, and the extra branch good for a further
     * 30 sliding days. Both callers must now land on the one successor.
     *
     * Which of the two paths gets taken here is up to the interleaving — the
     * later caller either loses the compare-and-swap or finds the row already
     * revoked and replays it. Both converge, which is the point; the guard
     * itself is pinned by the test below, where the interleaving is forced.
     */
    it('hands the same successor to two simultaneous refreshes', async () => {
      const signed = await signup('race@test.dev', 'candidate');
      const cookie = refreshCookieOf(signed);

      const [first, second] = await Promise.all([
        httpRequest(app).post('/api/auth/refresh').set('Cookie', cookie),
        httpRequest(app).post('/api/auth/refresh').set('Cookie', cookie),
      ]);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(refreshCookieOf(first)).toBe(refreshCookieOf(second));

      const live = await prisma.refreshToken.findMany({
        where: { revokedAt: null },
      });
      expect(live).toHaveLength(1);

      await httpRequest(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokenOf(second)}`)
        .expect(200);
    });

    /**
     * The guard itself, against a real database. Both callers start from the
     * same row read before either wrote — the interleaving two HTTP requests
     * only reach by luck, and the one `revoked_at IS NULL` exists for. Drop it
     * from the WHERE and both updates land, both mint, and the family forks.
     */
    it('lets only one of two interleaved rotations mint a successor', async () => {
      const signed = await signup('cas@test.dev', 'candidate');
      const raw = refreshCookieOf(signed).slice('rekr_rt='.length);

      const refreshTokens = app.get(RefreshTokenService);
      const row = await refreshTokens.findByToken(raw);

      const [first, second] = await Promise.all([
        refreshTokens.rotate(row!, raw, {}),
        refreshTokens.rotate(row!, raw, {}),
      ]);

      expect(first?.token).toBe(second?.token);

      const live = await prisma.refreshToken.findMany({
        where: { revokedAt: null },
      });
      expect(live).toHaveLength(1);
    });

    /**
     * The surplus branch used to make a signed-out session look alive, so the
     * predecessor of a logged-out token still replayed. A logout revokes
     * without recording a successor, and that empty column is what stops the
     * chain — even well inside the replay window.
     */
    it('refuses the predecessor of a token that has been logged out', async () => {
      const signed = await signup('logout-chain@test.dev', 'candidate');
      const first = refreshCookieOf(signed);

      const rotated = await httpRequest(app)
        .post('/api/auth/refresh')
        .set('Cookie', first)
        .expect(200);

      await httpRequest(app)
        .post('/api/auth/logout')
        .set('Cookie', refreshCookieOf(rotated))
        .expect(204);

      await httpRequest(app)
        .post('/api/auth/refresh')
        .set('Cookie', first)
        .expect(401);
    });

    it('clears the cookie on logout and refuses to refresh afterwards', async () => {
      const signed = await signup('bye@test.dev', 'candidate');
      const cookie = refreshCookieOf(signed);

      const res = await httpRequest(app)
        .post('/api/auth/logout')
        .set('Cookie', cookie)
        .expect(204);

      expect(cookiesOf(res).some((c) => c.startsWith('rekr_rt=;'))).toBe(true);

      await httpRequest(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);
    });

    it('answers 204 on a logout with no cookie', async () => {
      await httpRequest(app).post('/api/auth/logout').expect(204);
    });

    /** One row per session: signing out of the laptop must leave the phone
     * signed in. */
    it('leaves the other devices of the same user untouched', async () => {
      await signup('two-devices@test.dev', 'candidate');

      const phone = await httpRequest(app)
        .post('/api/auth/login')
        .send({ email: 'two-devices@test.dev', password: 'Sup3rSecret!' })
        .expect(200);
      const laptop = await httpRequest(app)
        .post('/api/auth/login')
        .send({ email: 'two-devices@test.dev', password: 'Sup3rSecret!' })
        .expect(200);

      await httpRequest(app)
        .post('/api/auth/logout')
        .set('Cookie', refreshCookieOf(laptop))
        .expect(204);

      await httpRequest(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookieOf(phone))
        .expect(200);
    });
  });
});
