import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { httpRequest } from './http-client';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
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
});
