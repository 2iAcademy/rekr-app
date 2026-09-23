import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { AccountRetentionService } from '../src/account/account-retention.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup-app';
import { resetDb } from './reset-db';

const NOW = new Date('2026-09-23T03:00:00Z');
const monthsAgo = (months: number) => {
  const date = new Date(NOW);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date;
};

describe('Account retention (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let retention: AccountRetentionService;

  const createUser = (
    userType: 'candidate' | 'recruiter' | 'admin',
    dates: { lastActiveAt?: Date | null; createdAt?: Date },
  ) =>
    prisma.user.create({
      data: {
        email: [userType, Date.now(), Math.random()].join('-') + '@test.dev',
        passwordHash: 'x',
        userType,
        lastActiveAt: dates.lastActiveAt ?? null,
        createdAt: dates.createdAt,
      },
    });

  const exists = async (id: number) =>
    (await prisma.user.count({ where: { id } })) === 1;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    retention = app.get(AccountRetentionService);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('erases an account left 24 months without any activity, and keeps the others', async () => {
    const stale = await createUser('candidate', {
      lastActiveAt: monthsAgo(25),
    });
    const recent = await createUser('candidate', {
      lastActiveAt: monthsAgo(23),
    });

    expect(await retention.purgeInactive(NOW)).toBe(1);

    expect(await exists(stale.id)).toBe(false);
    expect(await exists(recent.id)).toBe(true);
  });

  /** No activity recorded at all: the creation date is the only clock left. */
  it('falls back on the creation date when no activity was ever recorded', async () => {
    const old = await createUser('candidate', { createdAt: monthsAgo(30) });
    const fresh = await createUser('candidate', {});

    await retention.purgeInactive(NOW);

    expect(await exists(old.id)).toBe(false);
    expect(await exists(fresh.id)).toBe(true);
  });

  /** A staff account is not a user of the service the policy speaks about. */
  it('never purges an admin', async () => {
    const admin = await createUser('admin', { lastActiveAt: monthsAgo(40) });

    await retention.purgeInactive(NOW);

    expect(await exists(admin.id)).toBe(true);
  });

  /** The same erasure as a user's own request, company rule included. */
  it('takes the company of a stale last recruiter with it', async () => {
    const recruiter = await createUser('recruiter', {
      lastActiveAt: monthsAgo(25),
    });
    const company = await prisma.company.create({ data: { name: 'Acme' } });
    await prisma.recruiterProfile.create({
      data: {
        userId: recruiter.id,
        companyId: company.id,
        firstName: 'R',
        lastName: 'D',
      },
    });

    await retention.purgeInactive(NOW);

    expect(await prisma.company.count({ where: { id: company.id } })).toBe(0);
  });
});
