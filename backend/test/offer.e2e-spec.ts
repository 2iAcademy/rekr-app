import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { httpRequest } from './http-client';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type {
  CompanySize,
  ContractType,
  ExperienceLevel,
  OfferStatus,
  RemotePolicy,
  TagCategory,
} from '../generated/prisma/client';
import { configureApp } from '../src/setup-app';
import { bearerFor } from './auth-header';
import { stubCityReference } from './city-reference';
import { resetDb } from './reset-db';
import { resetCityCache } from './city-cache-reset';
import { resetThrottler } from './throttler-reset';
import { jobFamilyIdFor } from './job-family-reference';

describe('Offer (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  // The trade every fixture offer is filed under. Required at creation since
  // job families landed, and read once because the reference rows outlive
  // `resetDb`.
  let jobFamilyId: number;

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
    await app.listen(0, '127.0.0.1');

    prisma = app.get(PrismaService);
    jobFamilyId = await jobFamilyIdFor(prisma);
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
      .send({ jobFamilyId, title: 'Dev' })
      .expect(401);
  });

  it('forbids a candidate from creating an offer (403)', async () => {
    const candidate = await createUser('candidate');
    await httpRequest(app)
      .post('/api/offers')
      .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
      .send({ jobFamilyId, title: 'Dev' })
      .expect(403);
  });

  it("creates an offer bound to the recruiter's company with its matching axes and skills", async () => {
    const { user, company } = await seedRecruiterWithCompany('Acme');

    const res = await postOffer(user.id)
      .send({
        jobFamilyId,
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
    await postOffer(orphan.id).send({ title: 'Dev', jobFamilyId }).expect(404);
  });

  it("updates the recruiter's own offer", async () => {
    const { user } = await seedRecruiterWithCompany('Acme');
    const res = await postOffer(user.id)
      .send({ title: 'Dev', jobFamilyId })
      .expect(201);

    await httpRequest(app)
      .patch(`/api/offers/${offerIdOf(res)}`)
      .set('Authorization', bearerFor(app, user.id, 'recruiter'))
      .send({ jobFamilyId, title: 'Dev Senior', status: 'open' })
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
      .send({ jobFamilyId, title: 'Hijacked' })
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
      .send({ jobFamilyId, title: 'Hijacked' })
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
      .send({ jobFamilyId, title: 'Hijacked' })
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
      .send({ title: 'Dev', jobFamilyId })
      .expect(201);

    await httpRequest(app)
      .patch(`/api/offers/${offerIdOf(res)}`)
      .set('Authorization', bearerFor(app, intruder.user.id, 'recruiter'))
      .send({ jobFamilyId, title: 'Hijacked' })
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
      .send({ jobFamilyId, title: 'x' })
      .expect(404);
  });
  /**
   * Skills and benefits share the `offer_tag` pivot and are told apart by the
   * category of the tag they point at. These tests are about that boundary:
   * each list has to be writable without disturbing the other.
   */
  describe('benefits of an offer', () => {
    const tagsOf = (offerId: number) =>
      prisma.offerTag.findMany({
        where: { offerId },
        select: { tag: { select: { label: true, category: true } } },
      });

    const labelsOf = async (offerId: number, category: 'skill' | 'benefit') =>
      (await tagsOf(offerId))
        .filter((link) => link.tag.category === category)
        .map((link) => link.tag.label)
        .sort();

    const patchOffer = (userId: number, offerId: number) =>
      httpRequest(app)
        .patch(`/api/offers/${offerId}`)
        .set('Authorization', bearerFor(app, userId, 'recruiter'));

    it('stores the benefits sent at creation under their own category', async () => {
      const { user } = await seedRecruiterWithCompany('Acme');

      const res = await postOffer(user.id)
        .send({
          jobFamilyId,
          title: 'Dev',
          skills: ['React'],
          benefits: ['Mutuelle', 'Tickets restaurant'],
        })
        .expect(201);

      const offerId = offerIdOf(res);
      await expect(labelsOf(offerId, 'benefit')).resolves.toEqual([
        'Mutuelle',
        'Tickets restaurant',
      ]);
      await expect(labelsOf(offerId, 'skill')).resolves.toEqual(['React']);
    });

    it('keeps the benefits when a patch rewrites the skills alone', async () => {
      const { user } = await seedRecruiterWithCompany('Acme');
      const offerId = offerIdOf(
        await postOffer(user.id)
          .send({
            title: 'Dev',
            jobFamilyId,
            skills: ['React'],
            benefits: ['Mutuelle'],
          })
          .expect(201),
      );

      await patchOffer(user.id, offerId)
        .send({ skills: ['Vue'] })
        .expect(200);

      await expect(labelsOf(offerId, 'skill')).resolves.toEqual(['Vue']);
      await expect(labelsOf(offerId, 'benefit')).resolves.toEqual(['Mutuelle']);
    });

    it('keeps the skills when a patch rewrites the benefits alone', async () => {
      const { user } = await seedRecruiterWithCompany('Acme');
      const offerId = offerIdOf(
        await postOffer(user.id)
          .send({
            title: 'Dev',
            jobFamilyId,
            skills: ['React'],
            benefits: ['Mutuelle'],
          })
          .expect(201),
      );

      await patchOffer(user.id, offerId)
        .send({ benefits: ['Conciergerie'] })
        .expect(200);

      await expect(labelsOf(offerId, 'benefit')).resolves.toEqual([
        'Conciergerie',
      ]);
      await expect(labelsOf(offerId, 'skill')).resolves.toEqual(['React']);
    });

    it('clears the benefits when the patch sends an empty list', async () => {
      const { user } = await seedRecruiterWithCompany('Acme');
      const offerId = offerIdOf(
        await postOffer(user.id)
          .send({
            title: 'Dev',
            jobFamilyId,
            skills: ['React'],
            benefits: ['Mutuelle'],
          })
          .expect(201),
      );

      await patchOffer(user.id, offerId).send({ benefits: [] }).expect(200);

      await expect(labelsOf(offerId, 'benefit')).resolves.toEqual([]);
      await expect(labelsOf(offerId, 'skill')).resolves.toEqual(['React']);
    });

    // The candidate reads the perks on the offer they are about to like, so the
    // detail endpoint has to carry them with their category attached.
    it('serves the benefits of a published offer to a candidate', async () => {
      const { user } = await seedRecruiterWithCompany('Acme');
      const offerId = offerIdOf(
        await postOffer(user.id)
          .send({
            jobFamilyId,
            title: 'Dev',
            status: 'open',
            skills: ['React'],
            benefits: ['Mutuelle'],
          })
          .expect(201),
      );
      const candidate = await createUser('candidate');

      const res = await httpRequest(app)
        .get(`/api/offers/${offerId}`)
        .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
        .expect(200);

      const body = res.body as {
        tags: { label: string; category: string }[];
      };
      expect(body.tags).toEqual(
        expect.arrayContaining([{ label: 'Mutuelle', category: 'benefit' }]),
      );
    });

    it('refuses more benefits than the cap allows (400)', async () => {
      const { user } = await seedRecruiterWithCompany('Acme');

      await postOffer(user.id)
        .send({
          jobFamilyId,
          title: 'Dev',
          benefits: Array.from({ length: 51 }, (_, i) => `Avantage ${i}`),
        })
        .expect(400);
    });
  });

  /**
   * Interest, written down.
   *
   * A candidate likes an offer; the recruiter who owns it reads who applied and
   * may like back. No `Match` is derived from the pair here — the reciprocity
   * rule is #134's, and inventing it in passing would settle a product decision
   * this ticket does not carry.
   */
  describe('interest in an offer', () => {
    const asCandidate = (userId: number) => bearerFor(app, userId, 'candidate');

    const likeAsCandidate = (userId: number, offerId: number) =>
      httpRequest(app)
        .post(`/api/offers/${offerId}/like`)
        .set('Authorization', asCandidate(userId));

    const passAsCandidate = (userId: number, offerId: number) =>
      httpRequest(app)
        .post(`/api/offers/${offerId}/pass`)
        .set('Authorization', asCandidate(userId));

    const readInterested = (userId: number, offerId: number, query = '') =>
      httpRequest(app)
        .get(`/api/offers/${offerId}/likes${query}`)
        .set('Authorization', bearerFor(app, userId, 'recruiter'));

    const likeBack = (
      recruiterId: number,
      offerId: number,
      candidateUserId: number,
    ) =>
      httpRequest(app)
        .post(`/api/offers/${offerId}/likes/${candidateUserId}`)
        .set('Authorization', bearerFor(app, recruiterId, 'recruiter'));

    const seedCandidateWithProfile = async (firstName: string) => {
      const user = await createUser('candidate');
      await prisma.candidateProfile.create({
        data: {
          userId: user.id,
          firstName,
          lastName: 'Moreau',
          desiredJobTitle: 'Développeuse back-end',
          city: 'Lyon',
        },
      });
      return user;
    };

    const namesOf = (res: request.Response): string[] =>
      (res.body as { firstName: string }[]).map((item) => item.firstName);

    describe('POST /offers/:id/like', () => {
      it('rejects an unauthenticated like with 401', async () => {
        const { company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });

        await httpRequest(app).post(`/api/offers/${offer.id}/like`).expect(401);
      });

      it('forbids a recruiter from liking an offer (403)', async () => {
        const { user, company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });

        await httpRequest(app)
          .post(`/api/offers/${offer.id}/like`)
          .set('Authorization', bearerFor(app, user.id, 'recruiter'))
          .expect(403);
      });

      it('records the like of a candidate on a published offer', async () => {
        const { company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');

        await likeAsCandidate(candidate.id, offer.id).expect(201);

        await expect(
          prisma.candidateLikesOffer.count({
            where: { candidateUserId: candidate.id, offerId: offer.id },
          }),
        ).resolves.toBe(1);
      });

      // Liking twice is what a double tap produces, not an error to show.
      it('stays idempotent when the same candidate likes twice', async () => {
        const { company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');

        await likeAsCandidate(candidate.id, offer.id).expect(201);
        await likeAsCandidate(candidate.id, offer.id).expect(201);

        await expect(
          prisma.candidateLikesOffer.count({ where: { offerId: offer.id } }),
        ).resolves.toBe(1);
      });

      // Same 404 as the detail route, and for the same reason: a 403 on an
      // unpublished offer would confirm that the id exists.
      it.each(['draft', 'paused', 'filled', 'closed'] as const)(
        'refuses a like on a %s offer (404)',
        async (status) => {
          const { company } = await seedRecruiterWithCompany('Acme');
          const offer = await seedOffer(company, { status });
          const candidate = await seedCandidateWithProfile('Camille');

          await likeAsCandidate(candidate.id, offer.id).expect(404);

          await expect(prisma.candidateLikesOffer.count()).resolves.toBe(0);
        },
      );

      it('refuses a like on an offer that does not exist (404)', async () => {
        const candidate = await seedCandidateWithProfile('Camille');

        await likeAsCandidate(candidate.id, 999_999).expect(404);
      });
    });

    describe('exclusive answers', () => {
      const matchOf = (candidateUserId: number, offerId: number) =>
        prisma.match.count({ where: { candidateUserId, offerId } });

      it('drops the like when the candidate passes an offer they had liked', async () => {
        const { company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');

        await likeAsCandidate(candidate.id, offer.id).expect(201);
        await passAsCandidate(candidate.id, offer.id).expect(201);

        await expect(
          prisma.candidateLikesOffer.count({
            where: { candidateUserId: candidate.id, offerId: offer.id },
          }),
        ).resolves.toBe(0);
        await expect(
          prisma.candidatePassesOffer.count({
            where: { candidateUserId: candidate.id, offerId: offer.id },
          }),
        ).resolves.toBe(1);
      });

      it('drops the pass when the candidate likes an offer they had passed', async () => {
        const { company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');

        await passAsCandidate(candidate.id, offer.id).expect(201);
        const res = await likeAsCandidate(candidate.id, offer.id).expect(201);

        expect(res.body).toMatchObject({ likeCreated: true });
        await expect(
          prisma.candidatePassesOffer.count({
            where: { candidateUserId: candidate.id, offerId: offer.id },
          }),
        ).resolves.toBe(0);
        await expect(
          prisma.candidateLikesOffer.count({
            where: { candidateUserId: candidate.id, offerId: offer.id },
          }),
        ).resolves.toBe(1);
      });

      /**
       * A pass on a matched offer is refused rather than accepted with the
       * match left standing: the match is a mutual commitment the candidate
       * cannot undo from the offer screen, and a pass that silently keeps it
       * would leave the two lists telling opposite stories.
       */
      it('refuses to pass an offer already matched, and leaves the match alone', async () => {
        const { user, company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');

        await likeAsCandidate(candidate.id, offer.id).expect(201);
        await likeBack(user.id, offer.id, candidate.id).expect(201);
        await expect(matchOf(candidate.id, offer.id)).resolves.toBe(1);

        await passAsCandidate(candidate.id, offer.id).expect(409);

        await expect(matchOf(candidate.id, offer.id)).resolves.toBe(1);
        await expect(
          prisma.candidateLikesOffer.count({
            where: { candidateUserId: candidate.id, offerId: offer.id },
          }),
        ).resolves.toBe(1);
        await expect(
          prisma.candidatePassesOffer.count({
            where: { candidateUserId: candidate.id, offerId: offer.id },
          }),
        ).resolves.toBe(0);
      });
    });

    describe('DELETE /offers/:id/like', () => {
      const unlike = (userId: number, offerId: number) =>
        httpRequest(app)
          .delete(`/api/offers/${offerId}/like`)
          .set('Authorization', asCandidate(userId));

      it('rejects an unauthenticated withdrawal with 401', async () => {
        const { company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });

        await httpRequest(app)
          .delete(`/api/offers/${offer.id}/like`)
          .expect(401);
      });

      it('forbids a recruiter from withdrawing a like (403)', async () => {
        const { user, company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });

        await httpRequest(app)
          .delete(`/api/offers/${offer.id}/like`)
          .set('Authorization', bearerFor(app, user.id, 'recruiter'))
          .expect(403);
      });

      it('removes the like and stays idempotent', async () => {
        const { company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');

        await likeAsCandidate(candidate.id, offer.id).expect(201);
        await unlike(candidate.id, offer.id).expect(204);
        await unlike(candidate.id, offer.id).expect(204);

        await expect(
          prisma.candidateLikesOffer.count({
            where: { candidateUserId: candidate.id, offerId: offer.id },
          }),
        ).resolves.toBe(0);
      });

      it('never touches the like of another candidate', async () => {
        const { company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const camille = await seedCandidateWithProfile('Camille');
        const alex = await seedCandidateWithProfile('Alex');

        await likeAsCandidate(camille.id, offer.id).expect(201);
        await likeAsCandidate(alex.id, offer.id).expect(201);
        await unlike(alex.id, offer.id).expect(204);

        await expect(
          prisma.candidateLikesOffer.count({
            where: { candidateUserId: camille.id, offerId: offer.id },
          }),
        ).resolves.toBe(1);
      });

      // Same rule as the pass: a match is not undone from the offer screen.
      it('refuses to withdraw a like that has become a match (409)', async () => {
        const { user, company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');

        await likeAsCandidate(candidate.id, offer.id).expect(201);
        await likeBack(user.id, offer.id, candidate.id).expect(201);

        const res = await unlike(candidate.id, offer.id).expect(409);

        expect((res.body as { message: string }).message).toMatch(/match/i);
        await expect(
          prisma.candidateLikesOffer.count({
            where: { candidateUserId: candidate.id, offerId: offer.id },
          }),
        ).resolves.toBe(1);
        await expect(
          prisma.match.count({
            where: { candidateUserId: candidate.id, offerId: offer.id },
          }),
        ).resolves.toBe(1);
      });
    });

    describe('GET /offers/:id/likes', () => {
      it('rejects an unauthenticated read with 401', async () => {
        const { company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });

        await httpRequest(app).get(`/api/offers/${offer.id}/likes`).expect(401);
      });

      it('forbids a candidate from reading who applied (403)', async () => {
        const { company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');

        await httpRequest(app)
          .get(`/api/offers/${offer.id}/likes`)
          .set('Authorization', asCandidate(candidate.id))
          .expect(403);
      });

      it('lists the candidates who liked the offer', async () => {
        const { user, company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const camille = await seedCandidateWithProfile('Camille');
        const yanis = await seedCandidateWithProfile('Yanis');
        await likeAsCandidate(camille.id, offer.id).expect(201);
        await likeAsCandidate(yanis.id, offer.id).expect(201);

        const res = await readInterested(user.id, offer.id).expect(200);

        expect(namesOf(res).sort()).toEqual(['Camille', 'Yanis']);
      });

      it('leaves out a candidate who liked another offer of the same company', async () => {
        const { user, company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const sibling = await seedOffer(company, {
          title: 'Autre poste',
          status: 'open',
        });
        const camille = await seedCandidateWithProfile('Camille');
        const yanis = await seedCandidateWithProfile('Yanis');
        await likeAsCandidate(camille.id, offer.id).expect(201);
        await likeAsCandidate(yanis.id, sibling.id).expect(201);

        const res = await readInterested(user.id, offer.id).expect(200);

        expect(namesOf(res)).toEqual(['Camille']);
      });

      // 404 and not 403: telling a stranger « not yours » already tells them
      // the offer exists.
      it("hides the applicants of another company's offer behind a 404", async () => {
        const { company } = await seedRecruiterWithCompany('Acme');
        const other = await seedRecruiterWithCompany('Globex');
        const offer = await seedOffer(company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');
        await likeAsCandidate(candidate.id, offer.id).expect(201);

        await readInterested(other.user.id, offer.id).expect(404);
      });

      it('answers 404 on an offer that does not exist', async () => {
        const { user } = await seedRecruiterWithCompany('Acme');

        await readInterested(user.id, 999_999).expect(404);
      });

      // The recruiter drives the whole life cycle from their own screens, so a
      // paused or filled offer still has applicants to read.
      it.each(['draft', 'paused', 'filled', 'closed'] as const)(
        'still lists the applicants of a %s offer of the company',
        async (status) => {
          const { user, company } = await seedRecruiterWithCompany('Acme');
          const offer = await seedOffer(company, { status: 'open' });
          const candidate = await seedCandidateWithProfile('Camille');
          await likeAsCandidate(candidate.id, offer.id).expect(201);
          await prisma.offer.update({
            where: { id: offer.id },
            data: { status },
          });

          const res = await readInterested(user.id, offer.id).expect(200);

          expect(namesOf(res)).toEqual(['Camille']);
        },
      );

      /**
       * A deactivated account leaves the list. The rule was carried by the
       * retired deck and is restated here rather than dropped: the candidate is
       * gone from the product, and their name and photo have no reason to keep
       * reaching a recruiter.
       */
      it('leaves out an applicant whose account was deactivated', async () => {
        const { user, company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const camille = await seedCandidateWithProfile('Camille');
        const yanis = await seedCandidateWithProfile('Yanis');
        await likeAsCandidate(camille.id, offer.id).expect(201);
        await likeAsCandidate(yanis.id, offer.id).expect(201);
        await prisma.user.update({
          where: { id: yanis.id },
          data: { isActive: false },
        });

        const res = await readInterested(user.id, offer.id).expect(200);

        expect(namesOf(res)).toEqual(['Camille']);
      });

      /**
       * The badge and the screen must agree. Counted over the raw pivot, the
       * figure would announce people the list cannot show — and the gap would
       * tell the recruiter that an account was deactivated.
       */
      it('counts the same people the list shows', async () => {
        const { user, company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const shown = await seedCandidateWithProfile('Camille');
        const deactivated = await seedCandidateWithProfile('Yanis');
        // Signup writes the user, the wizard writes the profile: this one
        // stopped in between.
        const profileless = await createUser('candidate');
        for (const candidate of [shown, deactivated, profileless]) {
          await likeAsCandidate(candidate.id, offer.id).expect(201);
        }
        await prisma.user.update({
          where: { id: deactivated.id },
          data: { isActive: false },
        });

        const listed = await readInterested(user.id, offer.id).expect(200);
        const offers = await getOffers(user.id).expect(200);
        const counted = (
          offers.body as { id: number; applicantCount: number }[]
        ).find((item) => item.id === offer.id);

        expect(namesOf(listed)).toEqual(['Camille']);
        expect(counted?.applicantCount).toBe(1);
      });

      it('leaks no account data, internal key or geolocation', async () => {
        const { user, company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');
        await likeAsCandidate(candidate.id, offer.id).expect(201);

        const res = await readInterested(user.id, offer.id).expect(200);
        const [item] = res.body as Record<string, unknown>[];

        for (const forbidden of [
          'email',
          'passwordHash',
          'isActive',
          'role',
          'latitude',
          'longitude',
          'postalCode',
          'lastName',
        ]) {
          expect(item).not.toHaveProperty(forbidden);
        }
        expect(JSON.stringify(res.body)).not.toContain('@test.dev');
      });

      it('honours limit and page', async () => {
        const { user, company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        for (const name of ['Camille', 'Yanis', 'Sacha']) {
          const candidate = await seedCandidateWithProfile(name);
          await likeAsCandidate(candidate.id, offer.id).expect(201);
        }

        const first = await readInterested(
          user.id,
          offer.id,
          '?page=1&limit=2',
        ).expect(200);
        const second = await readInterested(
          user.id,
          offer.id,
          '?page=2&limit=2',
        ).expect(200);

        expect(namesOf(first)).toHaveLength(2);
        expect(namesOf(second)).toHaveLength(1);
      });

      it('rejects a limit outside its bounds (400)', async () => {
        const { user, company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });

        await readInterested(user.id, offer.id, '?limit=500').expect(400);
      });
    });

    describe('POST /offers/:id/likes/:candidateUserId', () => {
      it('rejects an unauthenticated like-back with 401', async () => {
        const { company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');

        await httpRequest(app)
          .post(`/api/offers/${offer.id}/likes/${candidate.id}`)
          .expect(401);
      });

      it('forbids a candidate from liking back (403)', async () => {
        const { company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');

        await httpRequest(app)
          .post(`/api/offers/${offer.id}/likes/${candidate.id}`)
          .set('Authorization', asCandidate(candidate.id))
          .expect(403);
      });

      it('records the interest of the recruiter in an applicant', async () => {
        const { user, company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');
        await likeAsCandidate(candidate.id, offer.id).expect(201);

        await likeBack(user.id, offer.id, candidate.id).expect(201);

        await expect(
          prisma.recruiterLikesCandidate.count({
            where: { recruiterUserId: user.id, candidateUserId: candidate.id },
          }),
        ).resolves.toBe(1);
      });

      it('stays idempotent when the recruiter likes the same applicant twice', async () => {
        const { user, company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');
        await likeAsCandidate(candidate.id, offer.id).expect(201);

        await likeBack(user.id, offer.id, candidate.id).expect(201);
        await likeBack(user.id, offer.id, candidate.id).expect(201);

        await expect(prisma.recruiterLikesCandidate.count()).resolves.toBe(1);
      });

      /**
       * The reciprocity rule belongs to #134. Asserted rather than left
       * unsaid: deriving a match here would settle a product decision this
       * ticket does not carry, and a later reader has to be able to tell the
       * omission from an oversight.
       */
      it('creates one match and reports which reciprocal request created it', async () => {
        const { user, company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');

        const candidateLike = await likeAsCandidate(
          candidate.id,
          offer.id,
        ).expect(201);
        expect(candidateLike.body).toMatchObject({
          likeCreated: true,
          matchCreated: false,
        });

        const recruiterLike = await likeBack(
          user.id,
          offer.id,
          candidate.id,
        ).expect(201);
        expect(recruiterLike.body).toMatchObject({
          likeCreated: true,
          matchCreated: true,
          match: {
            offer: { id: offer.id },
            counterpart: { kind: 'candidate', id: candidate.id },
          },
        });

        const duplicate = await likeBack(
          user.id,
          offer.id,
          candidate.id,
        ).expect(201);
        expect(duplicate.body).toMatchObject({
          likeCreated: false,
          matchCreated: false,
          match: { offer: { id: offer.id } },
        });
        await expect(
          prisma.match.count({
            where: { candidateUserId: candidate.id, offerId: offer.id },
          }),
        ).resolves.toBe(1);
      });

      it('creates exactly one match under concurrent recruiter decisions', async () => {
        const { user, company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');
        await likeAsCandidate(candidate.id, offer.id).expect(201);

        const responses = await Promise.all([
          likeBack(user.id, offer.id, candidate.id),
          likeBack(user.id, offer.id, candidate.id),
        ]);

        expect(responses.map((response) => response.status)).toEqual([
          201, 201,
        ]);
        expect(
          responses.map(
            (response) =>
              (response.body as { matchCreated: boolean }).matchCreated,
          ),
        ).toEqual(expect.arrayContaining([true, false]));
        await expect(
          prisma.match.count({
            where: { candidateUserId: candidate.id, offerId: offer.id },
          }),
        ).resolves.toBe(1);
      });

      it('creates a match when the candidate completes a pre-existing recruiter like', async () => {
        const { user, company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');
        await prisma.recruiterLikesCandidate.create({
          data: {
            recruiterUserId: user.id,
            candidateUserId: candidate.id,
            offerId: offer.id,
          },
        });

        const response = await likeAsCandidate(candidate.id, offer.id).expect(
          201,
        );

        expect(response.body).toMatchObject({
          likeCreated: true,
          matchCreated: true,
          match: {
            offer: { id: offer.id },
            counterpart: { kind: 'company', id: company.id },
          },
        });
        await expect(prisma.match.count()).resolves.toBe(1);
      });

      it('never crosses offers when creating a reciprocal match', async () => {
        const { user, company } = await seedRecruiterWithCompany('Acme');
        const first = await seedOffer(company, {
          status: 'open',
          title: 'First',
        });
        const second = await seedOffer(company, {
          status: 'open',
          title: 'Second',
        });
        const candidate = await seedCandidateWithProfile('Camille');
        await likeAsCandidate(candidate.id, first.id).expect(201);
        await likeAsCandidate(candidate.id, second.id).expect(201);

        await likeBack(user.id, second.id, candidate.id).expect(201);

        await expect(
          prisma.match.findMany({
            where: { candidateUserId: candidate.id },
            select: { offerId: true },
          }),
        ).resolves.toEqual([{ offerId: second.id }]);
      });

      // `GET /offers/:id/likes` serves the applicants of every status, so the
      // answer has to follow: refusing it left the recruiter reading a
      // candidate whose only remaining action was a pass (gh#191).
      it.each(['draft', 'paused', 'filled', 'closed'] as const)(
        'answers an applicant of an offer that left open (%s)',
        async (status) => {
          const { user, company } = await seedRecruiterWithCompany('Acme');
          const offer = await seedOffer(company, { status: 'open' });
          const candidate = await seedCandidateWithProfile('Camille');
          await likeAsCandidate(candidate.id, offer.id).expect(201);
          await prisma.offer.update({
            where: { id: offer.id },
            data: { status },
          });

          await httpRequest(app)
            .get(`/api/offers/${offer.id}/likes`)
            .set('Authorization', bearerFor(app, user.id, 'recruiter'))
            .expect(200)
            .expect(({ body }: { body: { userId: number }[] }) =>
              expect(body.map((row) => row.userId)).toEqual([candidate.id]),
            );
          const response = await likeBack(
            user.id,
            offer.id,
            candidate.id,
          ).expect(201);

          expect(response.body).toMatchObject({
            likeCreated: true,
            matchCreated: true,
          });
          await expect(
            prisma.recruiterLikesCandidate.count({
              where: {
                recruiterUserId: user.id,
                candidateUserId: candidate.id,
                offerId: offer.id,
              },
            }),
          ).resolves.toBe(1);
        },
      );

      // The converse of the rule above: `GET /offers/:id/likes` leaves out a
      // deactivated account, so it is not one the recruiter can answer either,
      // and the match would hand out the name of an account that is gone.
      it('refuses to like back a deactivated applicant the list does not serve (404)', async () => {
        const { user, company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');
        await likeAsCandidate(candidate.id, offer.id).expect(201);
        await prisma.user.update({
          where: { id: candidate.id },
          data: { isActive: false },
        });

        await likeBack(user.id, offer.id, candidate.id).expect(404);

        await expect(prisma.recruiterLikesCandidate.count()).resolves.toBe(0);
        await expect(prisma.match.count()).resolves.toBe(0);
      });

      it('refuses to like back a candidate who did not apply to the offer (404)', async () => {
        const { user, company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');

        await likeBack(user.id, offer.id, candidate.id).expect(404);

        await expect(prisma.recruiterLikesCandidate.count()).resolves.toBe(0);
      });

      it("refuses to like back through another company's offer (404)", async () => {
        const { company } = await seedRecruiterWithCompany('Acme');
        const other = await seedRecruiterWithCompany('Globex');
        const offer = await seedOffer(company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');
        await likeAsCandidate(candidate.id, offer.id).expect(201);

        await likeBack(other.user.id, offer.id, candidate.id).expect(404);

        await expect(prisma.recruiterLikesCandidate.count()).resolves.toBe(0);
      });
    });

    describe('POST pass endpoints', () => {
      it('records a candidate pass idempotently and refuses a non-open offer', async () => {
        const { company } = await seedRecruiterWithCompany('Acme');
        const open = await seedOffer(company, { status: 'open' });
        const closed = await seedOffer(company, { status: 'closed' });
        const candidate = await seedCandidateWithProfile('Camille');

        await passAsCandidate(candidate.id, open.id).expect(201);
        await passAsCandidate(candidate.id, open.id).expect(201);
        await passAsCandidate(candidate.id, closed.id).expect(404);

        await expect(
          prisma.candidatePassesOffer.count({
            where: { candidateUserId: candidate.id, offerId: open.id },
          }),
        ).resolves.toBe(1);
        await expect(
          prisma.candidatePassesOffer.count({
            where: { candidateUserId: candidate.id, offerId: closed.id },
          }),
        ).resolves.toBe(0);
      });

      it('records a recruiter pass only for an applicant of an owned offer', async () => {
        const owner = await seedRecruiterWithCompany('Acme');
        const outsider = await seedRecruiterWithCompany('Globex');
        const offer = await seedOffer(owner.company, { status: 'open' });
        const otherOffer = await seedOffer(owner.company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');

        await httpRequest(app)
          .post(`/api/offers/${offer.id}/passes/${candidate.id}`)
          .set('Authorization', bearerFor(app, owner.user.id, 'recruiter'))
          .expect(404);

        await likeAsCandidate(candidate.id, offer.id).expect(201);
        await likeAsCandidate(candidate.id, otherOffer.id).expect(201);
        await httpRequest(app)
          .post(`/api/offers/${offer.id}/passes/${candidate.id}`)
          .set('Authorization', bearerFor(app, outsider.user.id, 'recruiter'))
          .expect(404);

        await httpRequest(app)
          .post(`/api/offers/${offer.id}/passes/${candidate.id}`)
          .set('Authorization', bearerFor(app, owner.user.id, 'recruiter'))
          .expect(201);
        await httpRequest(app)
          .post(`/api/offers/${offer.id}/passes/${candidate.id}`)
          .set('Authorization', bearerFor(app, owner.user.id, 'recruiter'))
          .expect(201);

        await expect(
          prisma.recruiterPassesCandidate.count({
            where: {
              recruiterUserId: owner.user.id,
              candidateUserId: candidate.id,
              offerId: offer.id,
            },
          }),
        ).resolves.toBe(1);

        const applicants = await readInterested(owner.user.id, offer.id).expect(
          200,
        );
        const body: unknown = applicants.body;
        const [applicant] = body as Array<{
          userId: number;
          recruiterPassedAt: string | null;
          recruiterLikedAt: string | null;
        }>;
        expect(applicant).toMatchObject({
          userId: candidate.id,
          recruiterLikedAt: null,
        });
        expect(applicant?.recruiterPassedAt).toEqual(expect.any(String));

        const otherApplicants = await readInterested(
          owner.user.id,
          otherOffer.id,
        ).expect(200);
        const [otherApplicant] = otherApplicants.body as Array<{
          userId: number;
          recruiterPassedAt: string | null;
        }>;
        expect(otherApplicant).toMatchObject({
          userId: candidate.id,
          recruiterPassedAt: null,
        });
      });
    });
  });

  describe('GET /offers', () => {
    /**
     * The count is what makes the list actionable: without it the recruiter has
     * to open every offer to find the one people applied to.
     */
    it('carries the number of candidates interested in each offer', async () => {
      const { user, company } = await seedRecruiterWithCompany('Acme');
      const wanted = await seedOffer(company, {
        title: 'Convoitée',
        status: 'open',
      });
      const ignored = await seedOffer(company, {
        title: 'Ignorée',
        status: 'open',
      });
      for (const name of ['Camille', 'Yanis']) {
        const candidate = await createUser('candidate');
        await prisma.candidateProfile.create({
          data: { userId: candidate.id, firstName: name, lastName: 'M' },
        });
        await httpRequest(app)
          .post(`/api/offers/${wanted.id}/like`)
          .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
          .expect(201);
      }

      const res = await getOffers(user.id).expect(200);
      const counts = Object.fromEntries(
        (res.body as { id: number; applicantCount: number }[]).map((offer) => [
          offer.id,
          offer.applicantCount,
        ]),
      );

      expect(counts[wanted.id]).toBe(2);
      expect(counts[ignored.id]).toBe(0);
    });

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

  describe('GET /offers/:id', () => {
    type OfferDetailBody = {
      id: number;
      title: string;
      description: string | null;
      city: string | null;
      contractType: ContractType | null;
      minExperienceLevel: ExperienceLevel | null;
      remotePolicy: RemotePolicy | null;
      salaryMin: number | null;
      salaryMax: number | null;
      createdAt: string;
      company: {
        id: number;
        name: string;
        logo: string | null;
        size: CompanySize | null;
        description: string | null;
        city: string | null;
      };
      tags: { label: string; category: TagCategory }[];
    };

    type OfferOwnerDetailBody = OfferDetailBody & {
      postalCode: string | null;
      status: OfferStatus;
    };

    const DETAIL_KEYS = [
      'city',
      'company',
      'contractType',
      'createdAt',
      'description',
      'id',
      'minExperienceLevel',
      'remotePolicy',
      'salaryMax',
      'salaryMin',
      'tags',
      'title',
    ];

    // A candidate reads three keys more than a stranger: their own answer on
    // the offer, which the detail screen needs before it offers
    // « Passer / Liker », and whether that answer has turned into a match.
    const CANDIDATE_DETAIL_KEYS = [
      ...DETAIL_KEYS,
      'liked',
      'passed',
      'matched',
    ].sort();

    const OWNER_KEYS = [
      'city',
      'company',
      'contractType',
      'createdAt',
      'description',
      'id',
      'jobFamilyId',
      'minExperienceLevel',
      'postalCode',
      'remotePolicy',
      'salaryMax',
      'salaryMin',
      'status',
      'tags',
      'title',
    ];

    const COMPANY_KEYS = ['city', 'description', 'id', 'logo', 'name', 'size'];

    const TAG_KEYS = ['category', 'label'];

    // Probe values, not fixtures: they are picked so that finding them anywhere
    // in the serialised answer can only mean the column itself leaked. None of
    // them is a fragment of an id, of a salary, of the pinned creation date or
    // of the city name seeded alongside.
    const PROBE_POSTAL_CODE = '97531';
    const PROBE_LATITUDE = '12.3456789';
    const PROBE_LONGITUDE = '98.7654321';
    const PINNED_CREATED_AT = new Date('2026-03-04T05:06:07.000Z');

    type DetailOfferOverrides = {
      status?: OfferStatus;
      title?: string;
    };

    const seedShowcaseCompany = async (name: string) => {
      const seeded = await seedRecruiterWithCompany(name);
      const company = await prisma.company.update({
        where: { id: seeded.company.id },
        data: {
          logo: 'companies/1/logo/acme.webp',
          size: 'PME',
          description: 'Une belle boîte.',
          city: 'Lyon',
        },
      });

      return { user: seeded.user, company };
    };

    const seedDetailOffer = (
      companyId: number,
      createdById: number,
      overrides: DetailOfferOverrides = {},
    ) =>
      prisma.offer.create({
        data: {
          title: 'Développeur Front',
          description: 'Belle mission.',
          status: 'open',
          city: 'Lyon',
          postalCode: PROBE_POSTAL_CODE,
          latitude: PROBE_LATITUDE,
          longitude: PROBE_LONGITUDE,
          contractType: 'CDI',
          minExperienceLevel: 'CONFIRME',
          remotePolicy: 'HYBRID',
          salaryMin: 45000,
          salaryMax: 60000,
          createdAt: PINNED_CREATED_AT,
          companyId,
          createdById,
          ...overrides,
        },
      });

    const attachSkill = async (offerId: number, label: string) => {
      const tag = await prisma.tag.create({
        data: { label, category: 'skill' },
      });
      await prisma.offerTag.create({ data: { offerId, tagId: tag.id } });
    };

    const getDetail = (
      offerId: number,
      userId: number,
      userType: 'candidate' | 'recruiter',
    ) =>
      httpRequest(app)
        .get(`/api/offers/${offerId}`)
        .set('Authorization', bearerFor(app, userId, userType));

    it('serves a candidate the showcase fields and nothing else', async () => {
      const { user, company } = await seedShowcaseCompany('Acme');
      const candidate = await createUser('candidate');
      const offer = await seedDetailOffer(company.id, user.id);
      await attachSkill(offer.id, 'React');

      const res = await getDetail(offer.id, candidate.id, 'candidate').expect(
        200,
      );
      const body = res.body as OfferDetailBody;

      expect(Object.keys(body).sort()).toEqual(CANDIDATE_DETAIL_KEYS);
      expect(Object.keys(body.company).sort()).toEqual(COMPANY_KEYS);
      expect(Object.keys(body.tags[0]).sort()).toEqual(TAG_KEYS);
      expect(body).toMatchObject({
        id: offer.id,
        title: 'Développeur Front',
        description: 'Belle mission.',
        city: 'Lyon',
        contractType: 'CDI',
        minExperienceLevel: 'CONFIRME',
        remotePolicy: 'HYBRID',
        salaryMin: 45000,
        salaryMax: 60000,
        company: { id: company.id, name: 'Acme', size: 'PME', city: 'Lyon' },
        tags: [{ label: 'React', category: 'skill' }],
      });
    });

    // The pivot row is an internal join: `offerId` and `tagId` say nothing to
    // the screen and hand an enumerator two more id spaces to walk.
    it('flattens the tag pivot, exposing no join key', async () => {
      const { user, company } = await seedShowcaseCompany('Acme');
      const candidate = await createUser('candidate');
      const offer = await seedDetailOffer(company.id, user.id);
      await attachSkill(offer.id, 'React');

      const res = await getDetail(offer.id, candidate.id, 'candidate').expect(
        200,
      );
      const body = res.body as OfferDetailBody;

      expect(body).not.toHaveProperty('offerTags');
      expect(body.tags[0]).not.toHaveProperty('offerId');
      expect(body.tags[0]).not.toHaveProperty('tagId');
      expect(body.tags[0]).not.toHaveProperty('id');
    });

    // Attached in reverse: an order that only holds because the read asks for
    // it, and not because the pivot happened to be written that way.
    it('serves the tags in alphabetical order, whatever the order they were attached in', async () => {
      const { user, company } = await seedShowcaseCompany('Acme');
      const candidate = await createUser('candidate');
      const offer = await seedDetailOffer(company.id, user.id);
      await attachSkill(offer.id, 'Vue');
      await attachSkill(offer.id, 'Angular');

      const res = await getDetail(offer.id, candidate.id, 'candidate').expect(
        200,
      );
      const body = res.body as OfferDetailBody;

      expect(body.tags.map((tag) => tag.label)).toEqual(['Angular', 'Vue']);
    });

    it('leaks no account data, internal key or geolocation to a candidate', async () => {
      const { user, company } = await seedShowcaseCompany('Acme');
      const candidate = await createUser('candidate');
      const offer = await seedDetailOffer(company.id, user.id);

      const res = await getDetail(offer.id, candidate.id, 'candidate').expect(
        200,
      );
      const body = res.body as OfferDetailBody;

      expect(body).not.toHaveProperty('createdById');
      expect(body).not.toHaveProperty('companyId');
      expect(body).not.toHaveProperty('postalCode');
      expect(body).not.toHaveProperty('latitude');
      expect(body).not.toHaveProperty('longitude');
      expect(body).not.toHaveProperty('status');
      expect(body).not.toHaveProperty('updatedAt');
    });

    // Absent keys are not enough: a value moved under another name, nested in
    // `company`, or serialised inside a string would pass the checks above and
    // still be on the wire. The probe values are searched in the whole payload.
    it('keeps the postcode, the geolocation and the recruiter email off the wire for a candidate', async () => {
      const { user, company } = await seedShowcaseCompany('Acme');
      const candidate = await createUser('candidate');
      const offer = await seedDetailOffer(company.id, user.id);

      const res = await getDetail(offer.id, candidate.id, 'candidate').expect(
        200,
      );
      const payload = JSON.stringify(res.body);

      expect(payload).not.toContain(PROBE_POSTAL_CODE);
      expect(payload).not.toContain(PROBE_LATITUDE);
      expect(payload).not.toContain(PROBE_LONGITUDE);
      expect(payload).not.toContain(user.email);
    });

    it('serves the owning recruiter the postcode and the status, and nothing more', async () => {
      const { user, company } = await seedShowcaseCompany('Acme');
      const offer = await seedDetailOffer(company.id, user.id, {
        status: 'draft',
      });
      await attachSkill(offer.id, 'React');

      const res = await getDetail(offer.id, user.id, 'recruiter').expect(200);
      const body = res.body as OfferOwnerDetailBody;

      expect(Object.keys(body).sort()).toEqual(OWNER_KEYS);
      expect(Object.keys(body.company).sort()).toEqual(COMPANY_KEYS);
      expect(Object.keys(body.tags[0]).sort()).toEqual(TAG_KEYS);
      expect(body).toMatchObject({
        id: offer.id,
        postalCode: PROBE_POSTAL_CODE,
        status: 'draft',
      });
    });

    // The management screen reads the postcode and the status; it never reads
    // the coordinates, so ownership is no reason to ship them either.
    it('keeps the geolocation off the wire for the owning recruiter', async () => {
      const { user, company } = await seedShowcaseCompany('Acme');
      const offer = await seedDetailOffer(company.id, user.id);

      const res = await getDetail(offer.id, user.id, 'recruiter').expect(200);
      const payload = JSON.stringify(res.body);

      expect(payload).not.toContain(PROBE_LATITUDE);
      expect(payload).not.toContain(PROBE_LONGITUDE);
      expect(payload).not.toContain(user.email);
    });

    // Ownership is the company, never the author: a recruiter of another firm
    // reads an open offer exactly as a candidate does.
    it('serves a recruiter of another company the candidate shape of an open offer', async () => {
      const owner = await seedShowcaseCompany('Owner Corp');
      const intruder = await seedShowcaseCompany('Intruder Corp');
      const offer = await seedDetailOffer(owner.company.id, owner.user.id);

      const res = await getDetail(
        offer.id,
        intruder.user.id,
        'recruiter',
      ).expect(200);
      const body = res.body as OfferDetailBody;

      expect(Object.keys(body).sort()).toEqual(DETAIL_KEYS);
      expect(body).not.toHaveProperty('postalCode');
      expect(body).not.toHaveProperty('status');
      expect(JSON.stringify(res.body)).not.toContain(PROBE_POSTAL_CODE);
      expect(JSON.stringify(res.body)).not.toContain(PROBE_LATITUDE);
      expect(JSON.stringify(res.body)).not.toContain(PROBE_LONGITUDE);
    });

    /**
     * The one cell where the ownership read is skipped altogether: a recruiter
     * attached to no company reads the showcase, like anyone else. Pinned here
     * because nothing else would notice an `owned` that defaulted to true.
     */
    it('serves a recruiter without a company the candidate shape of an open offer', async () => {
      const { user, company } = await seedShowcaseCompany('Acme');
      const orphan = await createUser('recruiter');
      const offer = await seedDetailOffer(company.id, user.id);
      await attachSkill(offer.id, 'React');

      const res = await getDetail(offer.id, orphan.id, 'recruiter').expect(200);
      const body = res.body as OfferDetailBody;

      expect(Object.keys(body).sort()).toEqual(DETAIL_KEYS);
      expect(JSON.stringify(res.body)).not.toContain(PROBE_POSTAL_CODE);
    });

    /**
     * Reachable since the likes list links to this screen: before it, the deck
     * was the only way in and it never serves an answered offer.
     */
    it('carries the answer the calling candidate already gave', async () => {
      const { user, company } = await seedShowcaseCompany('Acme');
      const liker = await createUser('candidate');
      const passer = await createUser('candidate');
      const newcomer = await createUser('candidate');
      const offer = await seedDetailOffer(company.id, user.id);
      await prisma.candidateLikesOffer.create({
        data: { candidateUserId: liker.id, offerId: offer.id },
      });
      await prisma.candidatePassesOffer.create({
        data: { candidateUserId: passer.id, offerId: offer.id },
      });

      const liked = await getDetail(offer.id, liker.id, 'candidate').expect(
        200,
      );
      const passed = await getDetail(offer.id, passer.id, 'candidate').expect(
        200,
      );
      const untouched = await getDetail(
        offer.id,
        newcomer.id,
        'candidate',
      ).expect(200);

      expect(liked.body).toMatchObject({
        liked: true,
        passed: false,
        matched: false,
      });
      expect(passed.body).toMatchObject({
        liked: false,
        passed: true,
        matched: false,
      });
      expect(untouched.body).toMatchObject({
        liked: false,
        passed: false,
        matched: false,
      });
    });

    /**
     * A match does not clear the like, so a matched offer would otherwise read
     * as a plain like — and the screen would offer to withdraw a like the like
     * endpoint refuses to withdraw (409).
     */
    it('tells the matched candidate, and only them, that the offer matched', async () => {
      const { user, company } = await seedShowcaseCompany('Acme');
      const matchedCandidate = await createUser('candidate');
      const otherCandidate = await createUser('candidate');
      const offer = await seedDetailOffer(company.id, user.id);
      await prisma.candidateLikesOffer.createMany({
        data: [
          { candidateUserId: matchedCandidate.id, offerId: offer.id },
          { candidateUserId: otherCandidate.id, offerId: offer.id },
        ],
      });
      await prisma.match.create({
        data: {
          candidateUserId: matchedCandidate.id,
          offerId: offer.id,
          recruiterUserId: user.id,
        },
      });

      const mine = await getDetail(
        offer.id,
        matchedCandidate.id,
        'candidate',
      ).expect(200);
      const theirs = await getDetail(
        offer.id,
        otherCandidate.id,
        'candidate',
      ).expect(200);

      expect(mine.body).toMatchObject({ liked: true, matched: true });
      expect(theirs.body).toMatchObject({ liked: true, matched: false });
    });

    // Absent, not false: a recruiter has no answer to give on an offer.
    it('leaves matched out of the payload served to a recruiter', async () => {
      const { user, company } = await seedShowcaseCompany('Acme');
      const candidateUser = await createUser('candidate');
      const offer = await seedDetailOffer(company.id, user.id);
      await prisma.candidateLikesOffer.create({
        data: { candidateUserId: candidateUser.id, offerId: offer.id },
      });
      await prisma.match.create({
        data: {
          candidateUserId: candidateUser.id,
          offerId: offer.id,
          recruiterUserId: user.id,
        },
      });

      const res = await getDetail(offer.id, user.id, 'recruiter').expect(200);

      expect('matched' in (res.body as Record<string, unknown>)).toBe(false);
    });

    it('hides a draft offer from a recruiter without a company behind a 404', async () => {
      const { user, company } = await seedShowcaseCompany('Acme');
      const orphan = await createUser('recruiter');
      const offer = await seedDetailOffer(company.id, user.id, {
        status: 'draft',
      });

      await getDetail(offer.id, orphan.id, 'recruiter').expect(404);
    });

    it('returns 404 when reading a missing offer', async () => {
      const candidate = await createUser('candidate');

      await getDetail(999999, candidate.id, 'candidate').expect(404);
    });

    // 404 and not 403 throughout: a 403 on an offer the caller may not read
    // already confirms the id exists, which is the whole of what an enumeration
    // needs. A missing offer and a forbidden one must answer the same.
    it('hides a draft offer from a candidate behind a 404', async () => {
      const { user, company } = await seedShowcaseCompany('Acme');
      const candidate = await createUser('candidate');
      const offer = await seedDetailOffer(company.id, user.id, {
        status: 'draft',
      });

      const res = await getDetail(offer.id, candidate.id, 'candidate');

      expect(res.status).toBe(404);
    });

    it("hides another company's draft offer from a recruiter behind a 404", async () => {
      const owner = await seedShowcaseCompany('Owner Corp');
      const intruder = await seedShowcaseCompany('Intruder Corp');
      const offer = await seedDetailOffer(owner.company.id, owner.user.id, {
        status: 'draft',
      });

      const res = await getDetail(offer.id, intruder.user.id, 'recruiter');

      expect(res.status).toBe(404);
    });

    it('rejects an unauthenticated read with 401', async () => {
      const { user, company } = await seedShowcaseCompany('Acme');
      const offer = await seedDetailOffer(company.id, user.id);

      await httpRequest(app).get(`/api/offers/${offer.id}`).expect(401);
    });

    // A candidate reaches an offer only while it is `open`, whatever the reason
    // it left that state.
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
  });
});
