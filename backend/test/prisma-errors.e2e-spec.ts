import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { httpRequest } from './http-client';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup-app';
import { bearerFor } from './auth-header';
import { resetDb } from './reset-db';
import { resetThrottler } from './throttler-reset';

/**
 * Payloads a UI can legitimately produce, that the database rejects.
 *
 * `class-validator` guards shapes, not referential integrity: a `sectorId`
 * pointing at a row that no longer exists passes every DTO rule and blows up
 * inside Prisma. Untranslated, that is a 500 — an incident page for what is
 * really a client mistake.
 *
 * P2003 (foreign key) is the one code still reachable from HTTP, because no
 * amount of validation can tell whether a row exists. P2020 was reachable and
 * deliberately is not any more; see the block below. P2002 and P2025 are
 * covered at the unit level, since every service pre-checks them and only a
 * race can reach them through HTTP.
 */
describe('Prisma errors are translated (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const OUT_OF_INT4_RANGE = 3_000_000_000;
  const OUT_OF_DECIMAL_RANGE = 12_345_678_901.5;
  const MISSING_SECTOR_ID = 999_999;

  const createUser = (userType: 'candidate' | 'recruiter') =>
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
    return { user, company };
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

  describe('P2003 — a foreign key that points nowhere is a client error', () => {
    it('rejects a company created on a missing sector with 400', async () => {
      const recruiter = await createUser('recruiter');

      const res = await httpRequest(app)
        .post('/api/companies')
        .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
        .send({
          name: 'Acme',
          firstName: 'R',
          lastName: 'D',
          sectorId: MISSING_SECTOR_ID,
        });

      expect(res.status).toBe(400);
      expect(await prisma.company.count()).toBe(0);
      expect(await prisma.recruiterProfile.count()).toBe(0);
    });

    it('rejects a company updated onto a missing sector with 400', async () => {
      const { user } = await seedRecruiterWithCompany();

      const res = await httpRequest(app)
        .patch('/api/companies/mine')
        .set('Authorization', bearerFor(app, user.id, 'recruiter'))
        .send({ sectorId: MISSING_SECTOR_ID });

      expect(res.status).toBe(400);
    });

    it('still accepts a sector that exists', async () => {
      const recruiter = await createUser('recruiter');
      const sector = await prisma.sector.create({ data: { label: 'Tech' } });

      await httpRequest(app)
        .post('/api/companies')
        .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
        .send({
          name: 'Acme',
          firstName: 'R',
          lastName: 'D',
          sectorId: sector.id,
        })
        .expect(201);
    });
  });

  /**
   * P2020 no longer has an HTTP repro, on purpose.
   *
   * It used to have one: every numeric DTO field was bounded below and not
   * above, so a salary of 3e9 or a latitude of 1.2e10 reached Postgres and came
   * back as P2020. Mapping that to a 400 was an improvement over a 500, and
   * still the wrong place to stop — the request crossed the service and opened
   * a transaction before being refused, and the answer named no field.
   *
   * Those bounds are now on the DTOs (`common/validation/numeric-bounds.ts`),
   * so the same payloads are rejected at the boundary with the field named.
   * `test/security-hardening.e2e-spec.ts` asserts that, and asserts it by the
   * field name in the response, which is what distinguishes the two layers —
   * both answer 400.
   *
   * The P2020 mapping stays in the filter as a safety net for any numeric path
   * added later without a bound, and stays covered in
   * `src/prisma/prisma-exception.filter.spec.ts`. Keeping an e2e test here
   * would mean keeping an unbounded field in production to feed it.
   */
  describe('P2020 — now unreachable through the DTOs', () => {
    it('is refused by validation, not by the database', async () => {
      const user = await createUser('candidate');

      const res = await httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .send({
          firstName: 'Ada',
          lastName: 'Lovelace',
          salaryMin: OUT_OF_INT4_RANGE,
          latitude: OUT_OF_DECIMAL_RANGE,
        });

      expect(res.status).toBe(400);

      // The generic filter message would carry neither field name.
      const messages = (res.body as { message?: string[] }).message ?? [];
      expect(messages.join(' | ')).toContain('salaryMin');
      expect(messages.join(' | ')).toContain('latitude');
      expect(await prisma.candidateProfile.count()).toBe(0);
    });
  });

  it('never echoes the database constraint back to the client', async () => {
    const recruiter = await createUser('recruiter');

    const res = await httpRequest(app)
      .post('/api/companies')
      .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
      .send({
        name: 'Acme',
        firstName: 'R',
        lastName: 'D',
        sectorId: MISSING_SECTOR_ID,
      });

    const body = JSON.stringify(res.body);
    expect(body).not.toContain('company_fk_sector_fkey');
    expect(body).not.toContain('fk_sector');
    expect(body).not.toContain('prisma');
  });
});
