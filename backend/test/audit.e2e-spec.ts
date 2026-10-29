import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { AccountRetentionService } from '../src/account/account-retention.service';
import { AuditService } from '../src/audit/audit.service';
import { hashPassword } from '../src/auth/password-hash';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup-app';
import { bearerFor } from './auth-header';
import { httpRequest } from './http-client';
import { jobFamilyIdFor } from './job-family-reference';
import { resetDb } from './reset-db';
import { resetThrottler } from './throttler-reset';

const PASSWORD = 'Sup3rSecret!';

describe('Security journal (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordHash: string;

  const createUser = (userType: 'candidate' | 'recruiter') =>
    prisma.user.create({
      data: {
        email: [userType, Date.now(), Math.random()].join('-') + '@test.dev',
        passwordHash,
        userType,
      },
    });

  const events = () => prisma.auditEvent.findMany({ orderBy: { id: 'asc' } });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');

    prisma = app.get(PrismaService);
    passwordHash = await hashPassword(PASSWORD);
  });

  beforeEach(async () => {
    await resetDb(prisma);
    resetThrottler(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('records a failed login on an unknown address with no actor and a truncated address', async () => {
    await httpRequest(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@test.dev', password: PASSWORD })
      .expect(401);

    const [event] = await events();
    expect(event).toMatchObject({
      action: 'login_failed',
      actorId: null,
      ip: '127.0.0.0',
      detail: { reason: 'unknown_account' },
    });
    expect(JSON.stringify(event)).not.toContain('ghost');
  });

  it('records a wrong password against the account, then the successful login by it', async () => {
    const user = await createUser('candidate');

    await httpRequest(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Wrong-Pass1!' })
      .expect(401);
    await httpRequest(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);

    expect(
      (await events()).map(({ action, actorId, targetId }) => ({
        action,
        actorId,
        targetId,
      })),
    ).toEqual([
      { action: 'login_failed', actorId: null, targetId: user.id },
      { action: 'login_succeeded', actorId: user.id, targetId: null },
    ]);
  });

  it('keeps the record of a deletion after the account is gone', async () => {
    const user = await createUser('candidate');

    await httpRequest(app)
      .delete('/api/account')
      .set('Authorization', bearerFor(app, user.id, 'candidate'))
      .send({ password: PASSWORD })
      .expect(204);

    expect(await prisma.user.count({ where: { id: user.id } })).toBe(0);
    expect(await events()).toEqual([
      expect.objectContaining({
        action: 'account_deleted',
        actorId: user.id,
        targetType: 'user',
        targetId: user.id,
      }),
    ]);
  });

  it('records a deletion refused for a wrong password, and keeps the account', async () => {
    const user = await createUser('candidate');

    await httpRequest(app)
      .delete('/api/account')
      .set('Authorization', bearerFor(app, user.id, 'candidate'))
      .send({ password: 'Wrong-Pass1!' })
      .expect(403);

    expect(await prisma.user.count({ where: { id: user.id } })).toBe(1);
    expect(await events()).toEqual([
      expect.objectContaining({
        action: 'account_deletion_refused',
        actorId: null,
        targetType: 'user',
        targetId: user.id,
        ip: '127.0.0.0',
        detail: { reason: 'wrong_password' },
      }),
    ]);
  });

  it("hands the account holder their own journal in the export, and nobody else's", async () => {
    const user = await createUser('candidate');
    const stranger = await createUser('candidate');
    for (const email of [user.email, stranger.email]) {
      await httpRequest(app)
        .post('/api/auth/login')
        .send({ email, password: 'Wrong-Pass1!' })
        .expect(401);
    }
    await httpRequest(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);

    const res = await httpRequest(app)
      .get('/api/account/export')
      .set('Authorization', bearerFor(app, user.id, 'candidate'))
      .expect(200);

    const { securityEvents } = JSON.parse(res.text) as {
      securityEvents: { action: string; targetId: number | null }[];
    };
    expect(
      securityEvents.map(({ action, targetId }) => ({ action, targetId })),
    ).toEqual([
      { action: 'login_succeeded', targetId: null },
      { action: 'login_failed', targetId: user.id },
    ]);
  });

  it('records an account erased by the retention purge, with no actor', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'idle@test.dev',
        passwordHash,
        userType: 'candidate',
        lastActiveAt: new Date('2020-01-01T00:00:00Z'),
      },
    });

    await app.get(AccountRetentionService).purgeInactive(new Date());

    expect(await events()).toEqual([
      expect.objectContaining({
        action: 'account_purged',
        actorId: null,
        targetType: 'user',
        targetId: user.id,
      }),
    ]);
  });

  it('records an offer status change with both statuses, and nothing for an edit that keeps it', async () => {
    const user = await createUser('recruiter');
    const company = await prisma.company.create({ data: { name: 'Acme' } });
    await prisma.recruiterProfile.create({
      data: {
        userId: user.id,
        companyId: company.id,
        firstName: 'Rick',
        lastName: 'Deckard',
      },
    });
    const offer = await prisma.offer.create({
      data: {
        companyId: company.id,
        createdById: user.id,
        title: 'Développeuse back',
        status: 'open',
        jobFamilyId: await jobFamilyIdFor(prisma),
      },
    });
    const patch = (body: object) =>
      httpRequest(app)
        .patch(`/api/offers/${offer.id}`)
        .set('Authorization', bearerFor(app, user.id, 'recruiter'))
        .send(body)
        .expect(200);

    await patch({ title: 'Développeuse back confirmée' });
    await patch({ status: 'paused' });

    expect(await events()).toEqual([
      expect.objectContaining({
        action: 'offer_status_changed',
        actorId: user.id,
        targetType: 'offer',
        targetId: offer.id,
        ip: '127.0.0.0',
        detail: { from: 'open', to: 'paused' },
      }),
    ]);
  });

  it('purges the events older than twelve months and keeps the others', async () => {
    const now = new Date('2026-10-29T12:00:00Z');
    await prisma.auditEvent.createMany({
      data: [
        {
          action: 'login_succeeded',
          occurredAt: new Date('2025-10-28T12:00:00Z'),
        },
        {
          action: 'login_succeeded',
          occurredAt: new Date('2025-10-30T12:00:00Z'),
        },
      ],
    });

    expect(await app.get(AuditService).purgeExpired(now)).toBe(1);
    expect(await prisma.auditEvent.count()).toBe(1);
  });
});
