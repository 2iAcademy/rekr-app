import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { httpRequest } from './http-client';
import { AppModule } from './../src/app.module';
import { KafkaLogPublisherService } from '../src/kafka/kafka-log-publisher.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup-app';
import { bearerFor } from './auth-header';
import { resetDb } from './reset-db';
import { resetThrottler } from './throttler-reset';

/**
 * M4 — POST /api/logs/sample and POST /api/logs/error are unauthenticated and
 *      bypass the global ValidationPipe (`@Body('message')` has no DTO).
 * M5 — skills / benefits / contractTypes arrays are unbounded, and the
 *      find-or-create loop behind them is an N+1.
 *
 * The `/logs` callers in the M4 block are admin accounts. Authentication alone
 * turned out to be an insufficient gate — signup is free, so any visitor could
 * mint a token and write into the observability store — and the routes now
 * require the `admin` user type. Nothing was relaxed here: the 401 and 400
 * assertions are untouched, an authorised caller is simply needed for the
 * requests that must reach the ValidationPipe. The 403 for a plain account is
 * asserted in `security-hardening.e2e-spec.ts`.
 *
 * The Kafka publisher is replaced by a stub: these tests assert the HTTP
 * boundary (authentication + validation), not Kafka delivery. Stubbing also
 * keeps the red phase fast — no broker runs in this environment, and the real
 * publisher would spend ~10s on kafkajs retries per request.
 *
 * `resetThrottler` runs in `beforeEach` so that, once the M1 rate limit exists,
 * these tests do not start failing with 429 because of each other.
 */
const HUGE_ARRAY_SIZE = 5000;
const HUGE_LABEL_LENGTH = 100_000;
const SANE_ARRAY_SIZE = 20;
const LOGS_BURST = 25;

jest.setTimeout(120_000);

describe('Security hardening (e2e) — M4 / M5', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const publish = jest.fn().mockResolvedValue({ stubbed: true });

  const createUser = (userType: 'candidate' | 'recruiter' | 'admin') =>
    prisma.user.create({
      data: {
        email: `${userType}-${Date.now()}-${Math.random()}@test.dev`,
        passwordHash: 'x',
        userType,
      },
    });

  const seedRecruiterWithCompany = async () => {
    const user = await createUser('recruiter');
    const company = await prisma.company.create({ data: { name: 'Acme' } });
    await prisma.recruiterProfile.create({
      data: {
        userId: user.id,
        companyId: company.id,
        firstName: 'R',
        lastName: 'D',
      },
    });
    return user;
  };

  const labels = (count: number): string[] =>
    Array.from({ length: count }, (_, index) => `label-${index}`);

  const hugeLabel = (): string => 'a'.repeat(HUGE_LABEL_LENGTH);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(KafkaLogPublisherService)
      .useValue({ topicName: 'logs.raw.test', publish })
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(prisma);
    resetThrottler(app);
    publish.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('M4 — logs endpoints', () => {
    const postLog = (path: string) =>
      httpRequest(app).post(`/api/logs/${path}`);

    it('rejects POST /api/logs/sample without a token (401)', async () => {
      await postLog('sample').send({}).expect(401);
      expect(publish).not.toHaveBeenCalled();
    });

    it('rejects POST /api/logs/error without a token (401)', async () => {
      await postLog('error').send({ message: 'anonymous' }).expect(401);
      expect(publish).not.toHaveBeenCalled();
    });

    it('rejects POST /api/logs/sample with a malformed token (401)', async () => {
      await postLog('sample')
        .set('Authorization', 'Bearer not-a-jwt')
        .send({})
        .expect(401);
      expect(publish).not.toHaveBeenCalled();
    });

    it('still accepts a legitimate authenticated sample (202)', async () => {
      const admin = await createUser('admin');

      await postLog('sample')
        .set('Authorization', bearerFor(app, admin.id, 'admin'))
        .send({})
        .expect(202);

      expect(publish).toHaveBeenCalledTimes(1);
    });

    it('still accepts a legitimate authenticated error message (202)', async () => {
      const admin = await createUser('admin');

      await postLog('error')
        .set('Authorization', bearerFor(app, admin.id, 'admin'))
        .send({ message: 'Something went wrong' })
        .expect(202);

      expect(publish).toHaveBeenCalledTimes(1);
    });

    it('rejects a non-string message with 400, never 500', async () => {
      const admin = await createUser('admin');

      const res = await postLog('error')
        .set('Authorization', bearerFor(app, admin.id, 'admin'))
        .send({ message: 12345 });

      expect(res.status).toBe(400);
      expect(publish).not.toHaveBeenCalled();
    });

    it('rejects an object-shaped message with 400, never 500', async () => {
      const admin = await createUser('admin');

      const res = await postLog('error')
        .set('Authorization', bearerFor(app, admin.id, 'admin'))
        .send({ message: { $ne: null } });

      expect(res.status).toBe(400);
      expect(publish).not.toHaveBeenCalled();
    });

    it('rejects an unknown field with 400 (whitelist must apply here too)', async () => {
      const admin = await createUser('admin');

      const res = await postLog('error')
        .set('Authorization', bearerFor(app, admin.id, 'admin'))
        .send({ message: 'ok', hacker: 'x' });

      expect(res.status).toBe(400);
      expect(publish).not.toHaveBeenCalled();
    });

    it('rejects an unbounded message that still fits under the body limit (400)', async () => {
      const admin = await createUser('admin');

      const res = await postLog('error')
        .set('Authorization', bearerFor(app, admin.id, 'admin'))
        .send({ message: 'a'.repeat(50_000) });

      expect(res.status).toBe(400);
      expect(publish).not.toHaveBeenCalled();
    });

    it('never publishes a 10 MB message', async () => {
      const admin = await createUser('admin');

      const res = await postLog('error')
        .set('Authorization', bearerFor(app, admin.id, 'admin'))
        .send({ message: 'a'.repeat(10 * 1024 * 1024) });

      // Already 413 today: express body-parser caps the JSON body at 100 kB,
      // long before the (missing) DTO would see it. Kept as a non-regression
      // guard on "never 202, never 500", not as proof of the M4 fix.
      expect([400, 413]).toContain(res.status);
      expect(publish).not.toHaveBeenCalled();
    });

    it('throttles a logs flood with 429', async () => {
      const admin = await createUser('admin');
      const authorization = bearerFor(app, admin.id, 'admin');

      const statuses: number[] = [];
      for (let index = 0; index < LOGS_BURST; index += 1) {
        const res = await postLog('sample').set('Authorization', authorization);
        statuses.push(res.status);
      }

      expect(statuses).toContain(429);
      expect(statuses[statuses.length - 1]).toBe(429);
    });
  });

  /**
   * Note on the per-element length: the three "100 000-character label" tests
   * already pass today, because the DTOs carry `@MaxLength(100, { each: true })`
   * on skills / benefits. Only the *cardinality* of the arrays is unbounded.
   * They are kept as non-regression guards for the green phase.
   */
  describe('M5 — unbounded arrays and N+1 tag loop', () => {
    it('rejects 5000 skills on a candidate profile with 400', async () => {
      const user = await createUser('candidate');

      const res = await httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .send({
          firstName: 'Ada',
          lastName: 'Lovelace',
          skills: labels(HUGE_ARRAY_SIZE),
        });

      expect(res.status).toBe(400);
      expect(await prisma.tag.count()).toBe(0);
    });

    it('rejects a 100 000-character skill label with 400', async () => {
      const user = await createUser('candidate');

      const res = await httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .send({
          firstName: 'Ada',
          lastName: 'Lovelace',
          skills: [hugeLabel()],
        });

      expect(res.status).toBe(400);
      expect(await prisma.tag.count()).toBe(0);
    });

    it('rejects 5000 contractTypes on a candidate profile with 400', async () => {
      const user = await createUser('candidate');

      const res = await httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .send({
          firstName: 'Ada',
          lastName: 'Lovelace',
          contractTypes: Array.from({ length: HUGE_ARRAY_SIZE }, () => 'CDI'),
        });

      expect(res.status).toBe(400);
      expect(await prisma.candidateProfile.count()).toBe(0);
    });

    it('rejects 5000 skills on a candidate profile update with 400', async () => {
      const user = await createUser('candidate');

      await httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .send({ firstName: 'Ada', lastName: 'Lovelace' })
        .expect(201);

      const res = await httpRequest(app)
        .patch('/api/candidate-profiles/me')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .send({ skills: labels(HUGE_ARRAY_SIZE) });

      expect(res.status).toBe(400);
      expect(await prisma.tag.count()).toBe(0);
    });

    it('rejects 5000 benefits on a company with 400', async () => {
      const recruiter = await createUser('recruiter');

      const res = await httpRequest(app)
        .post('/api/companies')
        .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
        .send({
          name: 'Acme',
          firstName: 'R',
          lastName: 'D',
          benefits: labels(HUGE_ARRAY_SIZE),
        });

      expect(res.status).toBe(400);
      expect(await prisma.tag.count()).toBe(0);
    });

    it('rejects a 100 000-character benefit label with 400', async () => {
      const recruiter = await createUser('recruiter');

      const res = await httpRequest(app)
        .post('/api/companies')
        .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
        .send({
          name: 'Acme',
          firstName: 'R',
          lastName: 'D',
          benefits: [hugeLabel()],
        });

      expect(res.status).toBe(400);
      expect(await prisma.tag.count()).toBe(0);
    });

    it('rejects 5000 skills on an offer with 400', async () => {
      const recruiter = await seedRecruiterWithCompany();

      const res = await httpRequest(app)
        .post('/api/offers')
        .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
        .send({ title: 'Dev', skills: labels(HUGE_ARRAY_SIZE) });

      expect(res.status).toBe(400);
      expect(await prisma.tag.count()).toBe(0);
    });

    it('rejects a 100 000-character offer skill label with 400', async () => {
      const recruiter = await seedRecruiterWithCompany();

      const res = await httpRequest(app)
        .post('/api/offers')
        .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
        .send({ title: 'Dev', skills: [hugeLabel()] });

      expect(res.status).toBe(400);
      expect(await prisma.tag.count()).toBe(0);
    });

    it('still accepts a sane number of skills (guards against an over-tight bound)', async () => {
      const user = await createUser('candidate');

      await httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .send({
          firstName: 'Ada',
          lastName: 'Lovelace',
          skills: labels(SANE_ARRAY_SIZE),
        })
        .expect(201);

      expect(await prisma.tag.count()).toBe(SANE_ARRAY_SIZE);
    });

    it('still accepts a sane number of benefits (guards against an over-tight bound)', async () => {
      const recruiter = await createUser('recruiter');

      await httpRequest(app)
        .post('/api/companies')
        .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
        .send({
          name: 'Acme',
          firstName: 'R',
          lastName: 'D',
          benefits: labels(SANE_ARRAY_SIZE),
        })
        .expect(201);

      expect(await prisma.tag.count()).toBe(SANE_ARRAY_SIZE);
    });
  });
});
