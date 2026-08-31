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
          .send({ title: 'Dev', skills: ['React'], benefits: ['Mutuelle'] })
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
          .send({ title: 'Dev', skills: ['React'], benefits: ['Mutuelle'] })
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
          .send({ title: 'Dev', skills: ['React'], benefits: ['Mutuelle'] })
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
        offerTags: { tag: { label: string; category: string } }[];
      };
      expect(body.offerTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tag: expect.objectContaining({
              label: 'Mutuelle',
              category: 'benefit',
            }) as object,
          }),
        ]),
      );
    });

    it('refuses more benefits than the cap allows (400)', async () => {
      const { user } = await seedRecruiterWithCompany('Acme');

      await postOffer(user.id)
        .send({
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

    describe('GET /offers/liked', () => {
      const readLiked = (userId: number) =>
        httpRequest(app)
          .get('/api/offers/liked')
          .set('Authorization', asCandidate(userId));

      // `liked` sits under the same prefix as the `:id` detail route: declared
      // after it, the word would be parsed as an identifier.
      it('is reachable as a literal segment, not read as an id', async () => {
        const candidate = await seedCandidateWithProfile('Camille');

        await readLiked(candidate.id).expect(200);
      });

      it('rejects an unauthenticated read with 401', async () => {
        await httpRequest(app).get('/api/offers/liked').expect(401);
      });

      it('forbids a recruiter from reading the liked offers (403)', async () => {
        const { user } = await seedRecruiterWithCompany('Acme');

        await httpRequest(app)
          .get('/api/offers/liked')
          .set('Authorization', bearerFor(app, user.id, 'recruiter'))
          .expect(403);
      });

      it('lists the offers the caller liked, and only those', async () => {
        const { company } = await seedRecruiterWithCompany('Acme');
        const liked = await seedOffer(company, {
          title: 'Aimée',
          status: 'open',
        });
        await seedOffer(company, { title: 'Ignorée', status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');
        const other = await seedCandidateWithProfile('Yanis');
        const otherLiked = await seedOffer(company, {
          title: 'Aimée par un autre',
          status: 'open',
        });

        await likeAsCandidate(candidate.id, liked.id).expect(201);
        await likeAsCandidate(other.id, otherLiked.id).expect(201);

        const res = await readLiked(candidate.id).expect(200);

        expect(
          (res.body as { title: string }[]).map((offer) => offer.title),
        ).toEqual(['Aimée']);
      });

      /**
       * Same rule as the match list, and for the same reason: a like is not a
       * standing right to read the offer. Unpublished, the post is being
       * reworked — its current salary and description are not what the
       * candidate applied to, and `GET /offers/:id` would answer 404 on it.
       */
      it.each(['draft', 'paused', 'filled', 'closed'] as const)(
        'drops a liked offer once it is %s',
        async (status) => {
          const { user, company } = await seedRecruiterWithCompany('Acme');
          const offer = await seedOffer(company, { status: 'open' });
          const candidate = await seedCandidateWithProfile('Camille');
          await likeAsCandidate(candidate.id, offer.id).expect(201);
          await httpRequest(app)
            .patch(`/api/offers/${offer.id}`)
            .set('Authorization', bearerFor(app, user.id, 'recruiter'))
            .send({ status })
            .expect(200);

          const res = await readLiked(candidate.id).expect(200);

          expect(res.body).toEqual([]);
        },
      );

      it.each([
        ['a page beyond the int4 ceiling', '?page=1000000000000000000'],
        ['a page of zero', '?page=0'],
        ['a limit of zero', '?limit=0'],
        ['a limit over the cap', '?limit=500'],
      ])('rejects %s with 400', async (_label, query) => {
        const candidate = await seedCandidateWithProfile('Camille');

        await httpRequest(app)
          .get(`/api/offers/liked${query}`)
          .set('Authorization', asCandidate(candidate.id))
          .expect(400);
      });

      /**
       * Exhaustive on both levels, and on the offer itself rather than on its
       * company alone: this list shares `SHOWCASE_OFFER_COLUMNS` with the
       * candidate feed, so a column added there reaches two screens at once.
       * `toEqual` fails on an extra key, which is the point.
       */
      it('exposes the showcase fields of a liked offer and nothing else', async () => {
        const { company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, {
          status: 'open',
          city: 'Lyon',
          postalCode: '69003',
        });
        const candidate = await seedCandidateWithProfile('Camille');
        await likeAsCandidate(candidate.id, offer.id).expect(201);

        const res = await readLiked(candidate.id).expect(200);
        const [item] = res.body as { company: Record<string, unknown> }[];

        expect(Object.keys(item).sort()).toEqual([
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
        ]);
        expect(Object.keys(item.company).sort()).toEqual([
          'id',
          'logo',
          'name',
        ]);
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
      it('derives no match from the reciprocal pair', async () => {
        const { user, company } = await seedRecruiterWithCompany('Acme');
        const offer = await seedOffer(company, { status: 'open' });
        const candidate = await seedCandidateWithProfile('Camille');
        await likeAsCandidate(candidate.id, offer.id).expect(201);

        await likeBack(user.id, offer.id, candidate.id).expect(201);

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
