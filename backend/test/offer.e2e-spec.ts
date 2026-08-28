import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { httpRequest } from './http-client';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { OfferStatus } from '../generated/prisma/client';
import { configureApp } from '../src/setup-app';
import { bearerFor } from './auth-header';
import { stubCityReference } from './city-reference';
import { resetDb } from './reset-db';
import { resetCityCache } from './city-cache-reset';
import { resetThrottler } from './throttler-reset';

describe('Offer (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const createUser = (userType: 'candidate' | 'recruiter') =>
    prisma.user.create({
      data: {
        email: `${userType}-${Date.now()}-${Math.random()}@test.dev`,
        passwordHash: 'x',
        userType,
      },
    });

  const seedRecruiterWithCompany = async (name: string) => {
    const user = await createUser('recruiter');
    const company = await prisma.company.create({ data: { name } });
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

  const postOffer = (userId: number) =>
    httpRequest(app)
      .post('/api/offers')
      .set('Authorization', bearerFor(app, userId, 'recruiter'));

  const offerIdOf = (res: request.Response): number =>
    (res.body as { id: number }).id;

  const seedOffer = (
    company: { id: number },
    data: Partial<{
      title: string;
      status: OfferStatus;
      createdAt: Date;
      city: string;
      postalCode: string;
      salaryMin: number;
      salaryMax: number;
    }> = {},
  ) =>
    prisma.offer.create({
      data: { title: 'Dev', companyId: company.id, ...data },
    });

  const getOffers = (userId: number, query = '') =>
    httpRequest(app)
      .get(`/api/offers${query}`)
      .set('Authorization', bearerFor(app, userId, 'recruiter'));

  const listedIds = (res: request.Response): number[] =>
    (res.body as { id: number }[]).map((offer) => offer.id);

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
    resetCityCache(app);
    stubCityReference();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an unauthenticated create with 401', async () => {
    await httpRequest(app)
      .post('/api/offers')
      .send({ title: 'Dev' })
      .expect(401);
  });

  it('forbids a candidate from creating an offer (403)', async () => {
    const candidate = await createUser('candidate');
    await httpRequest(app)
      .post('/api/offers')
      .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
      .send({ title: 'Dev' })
      .expect(403);
  });

  it("creates an offer bound to the recruiter's company with its matching axes and skills", async () => {
    const { user, company } = await seedRecruiterWithCompany('Acme');

    const res = await postOffer(user.id)
      .send({
        title: 'Développeur Front',
        description: 'Belle mission.',
        contractType: 'CDI',
        minExperienceLevel: 'CONFIRME',
        remotePolicy: 'HYBRID',
        salaryMin: 45000,
        salaryMax: 60000,
        skills: ['React', 'TypeScript'],
      })
      .expect(201);

    const saved = await prisma.offer.findUnique({
      where: { id: offerIdOf(res) },
      include: { offerTags: { include: { tag: true } } },
    });

    expect(saved).toMatchObject({
      companyId: company.id,
      createdById: user.id,
      title: 'Développeur Front',
      contractType: 'CDI',
      minExperienceLevel: 'CONFIRME',
      remotePolicy: 'HYBRID',
      salaryMin: 45000,
      salaryMax: 60000,
      status: 'draft',
    });
    expect(saved?.offerTags.map((t) => t.tag.label).sort()).toEqual([
      'React',
      'TypeScript',
    ]);
  });

  it('rejects create when the recruiter has no company (404)', async () => {
    const orphan = await createUser('recruiter');
    await postOffer(orphan.id).send({ title: 'Dev' }).expect(404);
  });

  it("updates the recruiter's own offer", async () => {
    const { user } = await seedRecruiterWithCompany('Acme');
    const res = await postOffer(user.id).send({ title: 'Dev' }).expect(201);

    await httpRequest(app)
      .patch(`/api/offers/${offerIdOf(res)}`)
      .set('Authorization', bearerFor(app, user.id, 'recruiter'))
      .send({ title: 'Dev Senior', status: 'open' })
      .expect(200);

    const saved = await prisma.offer.findUnique({
      where: { id: offerIdOf(res) },
    });
    expect(saved).toMatchObject({ title: 'Dev Senior', status: 'open' });
  });

  it('rejects an unauthenticated update with 401', async () => {
    const { user, company } = await seedRecruiterWithCompany('Acme');
    const offer = await prisma.offer.create({
      data: { title: 'Dev', companyId: company.id, createdById: user.id },
    });

    await httpRequest(app)
      .patch(`/api/offers/${offer.id}`)
      .send({ title: 'Hijacked' })
      .expect(401);

    const saved = await prisma.offer.findUnique({ where: { id: offer.id } });
    expect(saved?.title).toBe('Dev');
  });

  it('forbids a candidate from updating an offer (403)', async () => {
    const { user, company } = await seedRecruiterWithCompany('Acme');
    const offer = await prisma.offer.create({
      data: { title: 'Dev', companyId: company.id, createdById: user.id },
    });
    const candidate = await createUser('candidate');

    // 403 and not 404 here: `RolesGuard` answers before the service ever looks
    // the offer up, so nothing about its existence is revealed either way.
    await httpRequest(app)
      .patch(`/api/offers/${offer.id}`)
      .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
      .send({ title: 'Hijacked' })
      .expect(403);

    const saved = await prisma.offer.findUnique({ where: { id: offer.id } });
    expect(saved?.title).toBe('Dev');
  });

  it('hides an offer from a recruiter without a company (404)', async () => {
    const { user, company } = await seedRecruiterWithCompany('Acme');
    const offer = await prisma.offer.create({
      data: { title: 'Dev', companyId: company.id, createdById: user.id },
    });
    const orphan = await createUser('recruiter');

    await httpRequest(app)
      .patch(`/api/offers/${offer.id}`)
      .set('Authorization', bearerFor(app, orphan.id, 'recruiter'))
      .send({ title: 'Hijacked' })
      .expect(404);

    const saved = await prisma.offer.findUnique({ where: { id: offer.id } });
    expect(saved?.title).toBe('Dev');
  });

  // 404 and not 403: telling a stranger « you may not touch this one » already
  // tells them the id exists, which is the whole of what an enumeration needs.
  // Same answer as a missing offer, checked side by side below.
  it("hides another recruiter's offer behind a 404", async () => {
    const owner = await seedRecruiterWithCompany('Owner Corp');
    const intruder = await seedRecruiterWithCompany('Intruder Corp');

    const res = await postOffer(owner.user.id)
      .send({ title: 'Dev' })
      .expect(201);

    await httpRequest(app)
      .patch(`/api/offers/${offerIdOf(res)}`)
      .set('Authorization', bearerFor(app, intruder.user.id, 'recruiter'))
      .send({ title: 'Hijacked' })
      .expect(404);

    const saved = await prisma.offer.findUnique({
      where: { id: offerIdOf(res) },
    });
    expect(saved?.title).toBe('Dev');
  });

  describe('clearing a salary range', () => {
    const patchSalary = async (body: Record<string, unknown>) => {
      const { user, company } = await seedRecruiterWithCompany('Acme');
      const offer = await seedOffer(company, {
        salaryMin: 45000,
        salaryMax: 60000,
      });

      const res = await httpRequest(app)
        .patch(`/api/offers/${offer.id}`)
        .set('Authorization', bearerFor(app, user.id, 'recruiter'))
        .send(body);

      const saved = await prisma.offer.findUnique({ where: { id: offer.id } });

      return { res, saved };
    };

    it('writes NULL when the patch sends an explicit null', async () => {
      const { res, saved } = await patchSalary({
        salaryMin: null,
        salaryMax: null,
      });

      expect(res.status).toBe(200);
      expect(saved?.salaryMin).toBeNull();
      expect(saved?.salaryMax).toBeNull();
    });

    it('clears one bound without touching the other', async () => {
      const { res, saved } = await patchSalary({ salaryMax: null });

      expect(res.status).toBe(200);
      expect(saved?.salaryMin).toBe(45000);
      expect(saved?.salaryMax).toBeNull();
    });

    // The counterpart of the test above, and the reason `null` had to be made
    // explicit: a PATCH that omits the field must leave the stored figure
    // alone, so « unchanged » and « cleared » cannot share one representation.
    it('keeps the stored range when the patch omits the fields', async () => {
      const { res, saved } = await patchSalary({ title: 'Dev Senior' });

      expect(res.status).toBe(200);
      expect(saved?.salaryMin).toBe(45000);
      expect(saved?.salaryMax).toBe(60000);
    });

    /**
     * The runtime already tolerated `null` — `@IsOptional()` is a conditional
     * validation that short-circuits on it — but nothing said so out loud, so
     * the generated schema typed the field `number` and no client could
     * express the clearing. That silence is the defect this guards: drop the
     * `nullable` annotation again and orval regenerates a type that forbids
     * the very payload the tests above prove the API accepts.
     */
    it('advertises the nullable salary in the OpenAPI document', () => {
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().build(),
      );
      const schema = document.components?.schemas?.UpdateOfferDto as {
        properties?: Record<string, { nullable?: boolean }>;
      };

      expect(schema.properties?.salaryMin?.nullable).toBe(true);
      expect(schema.properties?.salaryMax?.nullable).toBe(true);
    });

    it.each([
      ['a string', 'beaucoup'],
      ['a negative figure', -1],
      ['a figure over the int4 ceiling', 2_147_483_648],
      ['a decimal', 45000.5],
    ])('still rejects %s with 400', async (_label, salaryMin) => {
      const { res, saved } = await patchSalary({ salaryMin });

      expect(res.status).toBe(400);
      expect(saved?.salaryMin).toBe(45000);
    });
  });

  it('returns 404 when updating a missing offer', async () => {
    const { user } = await seedRecruiterWithCompany('Acme');
    await httpRequest(app)
      .patch('/api/offers/999999')
      .set('Authorization', bearerFor(app, user.id, 'recruiter'))
      .send({ title: 'x' })
      .expect(404);
  });
  describe('GET /offers', () => {
    it('rejects an unauthenticated list with 401', async () => {
      await httpRequest(app).get('/api/offers').expect(401);
    });

    it('forbids a candidate from listing offers (403)', async () => {
      const candidate = await createUser('candidate');
      await httpRequest(app)
        .get('/api/offers')
        .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
        .expect(403);
    });

    it("returns only the offers of the recruiter's own company", async () => {
      const owner = await seedRecruiterWithCompany('Owner Corp');
      const stranger = await seedRecruiterWithCompany('Stranger Corp');
      const mine = await seedOffer(owner.company, { title: 'Chez moi' });
      await seedOffer(stranger.company, { title: 'Chez eux' });

      const res = await getOffers(owner.user.id).expect(200);

      expect(listedIds(res)).toEqual([mine.id]);
    });

    // The management screen is where a recruiter reopens a closed offer or
    // publishes a draft, so the list must not hide either the way the candidate
    // feed does.
    it('returns every status, drafts and closed offers included', async () => {
      const { user, company } = await seedRecruiterWithCompany('Acme');
      for (const status of [
        'draft',
        'open',
        'paused',
        'filled',
        'closed',
      ] as OfferStatus[]) {
        await seedOffer(company, { status, title: status });
      }

      const res = await getOffers(user.id).expect(200);

      expect(
        (res.body as { status: string }[]).map((o) => o.status).sort(),
      ).toEqual(['closed', 'draft', 'filled', 'open', 'paused']);
    });

    it('orders the list from the newest offer to the oldest', async () => {
      const { user, company } = await seedRecruiterWithCompany('Acme');
      const old = await seedOffer(company, {
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      const recent = await seedOffer(company, {
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      });

      const res = await getOffers(user.id).expect(200);

      expect(listedIds(res)).toEqual([recent.id, old.id]);
    });

    it('narrows the list to the requested status', async () => {
      const { user, company } = await seedRecruiterWithCompany('Acme');
      const published = await seedOffer(company, { status: 'open' });
      await seedOffer(company, { status: 'draft' });

      const res = await getOffers(user.id, '?status=open').expect(200);

      expect(listedIds(res)).toEqual([published.id]);
    });

    it('honours limit and page', async () => {
      const { user, company } = await seedRecruiterWithCompany('Acme');
      const first = await seedOffer(company, {
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      });
      const second = await seedOffer(company, {
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      });
      const third = await seedOffer(company, {
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const page1 = await getOffers(user.id, '?limit=2').expect(200);
      expect(listedIds(page1)).toEqual([first.id, second.id]);

      const page2 = await getOffers(user.id, '?limit=2&page=2').expect(200);
      expect(listedIds(page2)).toEqual([third.id]);
    });

    it('rejects a limit outside its bounds (400)', async () => {
      const { user } = await seedRecruiterWithCompany('Acme');

      await getOffers(user.id, '?limit=0').expect(400);
      await getOffers(user.id, '?limit=101').expect(400);
      await getOffers(user.id, '?page=0').expect(400);
    });

    // `Number.isInteger(1e18)` is true, so `@IsInt() @Min(1)` alone lets a
    // float-notation page through; the resulting `skip` overflows what Prisma
    // accepts and surfaces as a 500 instead of a validation error.
    it.each(['1e18', '1e19', '1e30'])(
      'rejects a page written in float notation (%s) with a 400',
      async (page) => {
        const { user } = await seedRecruiterWithCompany('Acme');

        await getOffers(user.id, `?page=${page}`).expect(400);
      },
    );

    it('still serves a high but legitimate page as an empty list (200)', async () => {
      const { user, company } = await seedRecruiterWithCompany('Acme');
      await seedOffer(company);

      const res = await getOffers(user.id, '?page=100000000').expect(200);

      expect(listedIds(res)).toEqual([]);
    });

    it('rejects an unknown status (400)', async () => {
      const { user } = await seedRecruiterWithCompany('Acme');

      await getOffers(user.id, '?status=archived').expect(400);
    });

    it('rejects the list when the recruiter has no company (404)', async () => {
      const orphan = await createUser('recruiter');

      await getOffers(orphan.id).expect(404);
    });
  });

  describe('GET /offers/:id seen by a candidate', () => {
    // #135 will build the candidate feed on top of this endpoint. Until then
    // the invariant it relies on is pinned here: a candidate reaches an offer
    // only while it is `open`, whatever the reason it left that state.
    it.each(['draft', 'paused', 'filled', 'closed'] as OfferStatus[])(
      'hides a %s offer from a candidate behind a 404',
      async (status) => {
        const { company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status });
        const candidate = await createUser('candidate');

        await httpRequest(app)
          .get(`/api/offers/${offer.id}`)
          .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
          .expect(404);
      },
    );

    it('shows an open offer to a candidate, with its company and its skills', async () => {
      const { user, company } = await seedRecruiterWithCompany('Acme');
      const created = await postOffer(user.id)
        .send({
          title: 'Dev',
          city: 'Lyon',
          postalCode: '69001',
          status: 'open',
          skills: ['React'],
        })
        .expect(201);
      const candidate = await createUser('candidate');

      const res = await httpRequest(app)
        .get(`/api/offers/${offerIdOf(created)}`)
        .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
        .expect(200);

      expect(res.body).toMatchObject({
        id: offerIdOf(created),
        title: 'Dev',
        status: 'open',
        company: { id: company.id, name: 'Acme' },
        offerTags: [{ tag: { label: 'React', category: 'skill' } }],
      });
    });

    // `Decimal(10, 7)` crosses JSON as a string, and the detail page parses it
    // as such. Pinned here because the DTO declares it that way.
    it('serialises the coordinates of an offer as strings', async () => {
      const { user } = await seedRecruiterWithCompany('Acme');
      const created = await postOffer(user.id)
        .send({
          title: 'Dev',
          city: 'Lyon',
          postalCode: '69001',
          status: 'open',
        })
        .expect(201);
      const candidate = await createUser('candidate');

      const res = await httpRequest(app)
        .get(`/api/offers/${offerIdOf(created)}`)
        .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
        .expect(200);

      const { latitude, longitude } = res.body as {
        latitude: unknown;
        longitude: unknown;
      };
      expect(typeof latitude).toBe('string');
      expect(typeof longitude).toBe('string');
      expect(Number(latitude)).toBeCloseTo(45.758);
      expect(Number(longitude)).toBeCloseTo(4.835);
    });
  });
});
