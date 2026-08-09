import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { httpRequest } from './http-client';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
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

  it('returns 404 when updating a missing offer', async () => {
    const { user } = await seedRecruiterWithCompany('Acme');
    await httpRequest(app)
      .patch('/api/offers/999999')
      .set('Authorization', bearerFor(app, user.id, 'recruiter'))
      .send({ title: 'x' })
      .expect(404);
  });
});
