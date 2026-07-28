import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { httpRequest } from './http-client';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup-app';
import { resetDb } from './reset-db';
import { resetThrottler } from './throttler-reset';

/**
 * M1 — no rate limiting on POST /api/auth/login and POST /api/auth/signup.
 * M2 — account enumeration through the 409 of POST /api/auth/signup.
 *
 * These live in a dedicated spec file on purpose: rate-limit counters are keyed
 * by client IP, and supertest always calls from 127.0.0.1. A separate file gets
 * its own Nest application, therefore its own in-memory throttler storage, so
 * the burst tests below cannot leak into the functional suites (auth, company,
 * offer, candidate-profile). Inside this file, `resetThrottler` in `beforeEach`
 * keeps every test independent of execution order.
 *
 * The two constants bracket the acceptable limit for the green phase:
 *   - NORMAL_USAGE requests must never be throttled (a human retrying a typo);
 *   - BURST requests must be throttled (a script).
 * Any per-window limit strictly between 3 and 25 satisfies both tests.
 */
const BURST = 25;
const NORMAL_USAGE = 3;

jest.setTimeout(120_000);

describe('Rate limiting (e2e) — M1 / M2', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const post = (url: string, body: Record<string, unknown>) =>
    httpRequest(app).post(url).send(body);

  const collectStatuses = async (
    count: number,
    fire: (index: number) => Promise<request.Response>,
  ): Promise<number[]> => {
    const statuses: number[] = [];
    for (let index = 0; index < count; index += 1) {
      statuses.push((await fire(index)).status);
    }
    return statuses;
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
    resetThrottler(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('M1 — throttles a login brute-force burst with 429', async () => {
    const statuses = await collectStatuses(BURST, () =>
      post('/api/auth/login', {
        email: 'victim@test.dev',
        password: 'wrong-password',
      }),
    );

    expect(statuses).toContain(429);
    expect(statuses[statuses.length - 1]).toBe(429);
  });

  it('M1 — throttles a signup burst with 429', async () => {
    const statuses = await collectStatuses(BURST, (index) =>
      post('/api/auth/signup', {
        email: `burst-${index}@test.dev`,
        password: 'Sup3rSecret!',
        userType: 'candidate',
      }),
    );

    expect(statuses).toContain(429);
    expect(statuses[statuses.length - 1]).toBe(429);
  });

  it('M1 — does not throttle a normal login sequence', async () => {
    await post('/api/auth/signup', {
      email: 'normal@test.dev',
      password: 'Sup3rSecret!',
      userType: 'candidate',
    }).expect(201);

    const statuses = await collectStatuses(NORMAL_USAGE, () =>
      post('/api/auth/login', {
        email: 'normal@test.dev',
        password: 'Sup3rSecret!',
      }),
    );

    expect(statuses).toEqual([200, 200, 200]);
  });

  it('M1 — does not throttle a normal signup sequence', async () => {
    const statuses = await collectStatuses(NORMAL_USAGE, (index) =>
      post('/api/auth/signup', {
        email: `normal-${index}@test.dev`,
        password: 'Sup3rSecret!',
        userType: 'candidate',
      }),
    );

    expect(statuses).toEqual([201, 201, 201]);
  });

  it('M1 — keeps /api/auth/me usable under a normal sequence', async () => {
    const created = await post('/api/auth/signup', {
      email: 'me@test.dev',
      password: 'Sup3rSecret!',
      userType: 'candidate',
    }).expect(201);

    const token = (created.body as { accessToken: string }).accessToken;

    const statuses = await collectStatuses(NORMAL_USAGE, () =>
      httpRequest(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`),
    );

    expect(statuses).toEqual([200, 200, 200]);
  });

  /**
   * M2 — assumed limitation, do NOT "fix" this one.
   *
   * Without an e-mail verification flow (explicitly out of scope), a legitimate
   * user must be told that their account already exists. The 409 is therefore
   * part of the contract and must keep passing after the green phase. M2 can
   * only be MITIGATED by the M1 rate limit, never closed.
   */
  it('M2 — keeps the honest 409 on a duplicate signup (assumed limitation)', async () => {
    const payload = {
      email: 'duplicate@test.dev',
      password: 'Sup3rSecret!',
      userType: 'candidate',
    };

    await post('/api/auth/signup', payload).expect(201);
    await post('/api/auth/signup', payload).expect(409);
  });

  it('M2 — throttles the enumeration loop that the 409 enables', async () => {
    await post('/api/auth/signup', {
      email: 'known@test.dev',
      password: 'Sup3rSecret!',
      userType: 'candidate',
    }).expect(201);

    const statuses = await collectStatuses(BURST, (index) =>
      post('/api/auth/signup', {
        email: `probe-${index}@test.dev`,
        password: 'Sup3rSecret!',
        userType: 'candidate',
      }),
    );

    expect(statuses).toContain(429);
    expect(statuses[statuses.length - 1]).toBe(429);
  });
});
