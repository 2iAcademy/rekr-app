import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup-app';
import { bearerFor } from './auth-header';
import { httpRequest } from './http-client';
import { resetDb } from './reset-db';
import { resetThrottler } from './throttler-reset';

describe('Match (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const createUser = (userType: 'candidate' | 'recruiter') =>
    prisma.user.create({
      data: {
        email: [userType, Date.now(), Math.random()].join('-') + '@test.dev',
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

  /**
   * The same endpoint serves each role's own matches. The recruiter response
   * must be isolated by company and expose the candidate counterpart.
   */
  it("returns only the company's matches with candidate counterparts", async () => {
    const recruiter = await seedRecruiterWithCompany('Acme');
    const otherRecruiter = await seedRecruiterWithCompany('Globex');
    const candidate = await createUser('candidate');
    await prisma.candidateProfile.create({
      data: { userId: candidate.id, firstName: 'Ada', lastName: 'Lovelace' },
    });
    const ownOffer = await prisma.offer.create({
      data: { title: 'Own', status: 'open', companyId: recruiter.company.id },
    });
    const otherOffer = await prisma.offer.create({
      data: {
        title: 'Other',
        status: 'open',
        companyId: otherRecruiter.company.id,
      },
    });
    const ownMatch = await prisma.match.create({
      data: {
        candidateUserId: candidate.id,
        offerId: ownOffer.id,
        recruiterUserId: recruiter.user.id,
      },
    });
    await prisma.match.create({
      data: {
        candidateUserId: candidate.id,
        offerId: otherOffer.id,
        recruiterUserId: otherRecruiter.user.id,
      },
    });

    const response = await httpRequest(app)
      .get('/api/matches')
      .set('Authorization', bearerFor(app, recruiter.user.id, 'recruiter'))
      .expect(200);

    const matches = response.body as Array<{
      id: number;
      matchedAt: string;
      offer: { id: number; title: string };
      counterpart: {
        kind: string;
        id: number;
        name: string;
        avatarUrl: string | null;
        headline: string | null;
      };
    }>;

    expect(matches).toHaveLength(1);
    const match = matches[0];
    expect(match).toMatchObject({
      id: ownMatch.id,
      offer: { id: ownOffer.id, title: 'Own' },
      counterpart: {
        kind: 'candidate',
        id: candidate.id,
        name: 'Ada Lovelace',
        avatarUrl: null,
        headline: null,
      },
    });
    expect(match?.matchedAt).toEqual(expect.any(String));
  });

  /**
   * The list points at `/recruteur/offres/:id/candidats`, which is guarded by
   * the company. A match concluded by a colleague still belongs to the
   * company, so it must be listed rather than hidden.
   */
  it('returns a match concluded by a colleague of the same company', async () => {
    const recruiter = await seedRecruiterWithCompany('Acme');
    const colleague = await createUser('recruiter');
    await prisma.recruiterProfile.create({
      data: {
        userId: colleague.id,
        companyId: recruiter.company.id,
        firstName: 'C',
        lastName: 'D',
      },
    });
    const candidate = await createUser('candidate');
    await prisma.candidateProfile.create({
      data: { userId: candidate.id, firstName: 'Ada', lastName: 'Lovelace' },
    });
    const offer = await prisma.offer.create({
      data: { title: 'Own', status: 'open', companyId: recruiter.company.id },
    });
    const match = await prisma.match.create({
      data: {
        candidateUserId: candidate.id,
        offerId: offer.id,
        recruiterUserId: colleague.id,
      },
    });

    const res = await httpRequest(app)
      .get('/api/matches')
      .set('Authorization', bearerFor(app, recruiter.user.id, 'recruiter'))
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect((res.body as { id: number }[])[0].id).toBe(match.id);
  });

  /**
   * The case observed in QA: the recruiter concluded the match, then the offer
   * moved to another company. The row would still show, but the screen it
   * points at answers 404.
   */
  it('hides a match whose offer has left the recruiter’s company', async () => {
    const recruiter = await seedRecruiterWithCompany('Acme');
    const other = await seedRecruiterWithCompany('Globex');
    const candidate = await createUser('candidate');
    await prisma.candidateProfile.create({
      data: { userId: candidate.id, firstName: 'Ada', lastName: 'Lovelace' },
    });
    const movedOffer = await prisma.offer.create({
      data: {
        title: 'ZZ Offre deja matchee',
        status: 'open',
        companyId: other.company.id,
      },
    });
    await prisma.match.create({
      data: {
        candidateUserId: candidate.id,
        offerId: movedOffer.id,
        recruiterUserId: recruiter.user.id,
      },
    });

    const res = await httpRequest(app)
      .get('/api/matches')
      .set('Authorization', bearerFor(app, recruiter.user.id, 'recruiter'))
      .expect(200);

    expect(res.body).toEqual([]);
  });

  /**
   * Diverges from `GET /likes/received`, which answers 404: `/matches` has
   * always answered 200 for a recruiter without a company, and the screen is
   * unreachable for them anyway.
   */
  it('returns an empty list for a recruiter without a company', async () => {
    const recruiter = await createUser('recruiter');

    const res = await httpRequest(app)
      .get('/api/matches')
      .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
      .expect(200);

    expect(res.body).toEqual([]);
  });

  it('rejects an unauthenticated read with 401', async () => {
    await httpRequest(app).get('/api/matches').expect(401);
  });

  /**
   * The generated client relies on this discriminator: candidates receive a
   * company counterpart and recruiters a candidate counterpart. It is always
   * present even if the candidate has not completed a profile.
   */
  it('advertises a single, always-present counterpart in the OpenAPI document', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    const schemas = document.components?.schemas as Record<
      string,
      {
        properties?: Record<string, { enum?: string[]; nullable?: boolean }>;
        required?: string[];
      }
    >;

    expect(schemas.MatchCounterpartDto.properties?.kind?.enum).toEqual([
      'company',
      'candidate',
    ]);
    expect(schemas.MatchListItemDto.properties?.counterpart?.nullable).not.toBe(
      true,
    );
    expect(schemas.MatchListItemDto.required).toContain('counterpart');
  });

  /**
   * The tenant axis, observed rather than mocked.
   *
   * Both matches sit on the same open offer, so nothing but `candidateUserId`
   * tells them apart: drop it from the `where` and this test fails, where a
   * fixture with a single candidate would still pass. It replaces the
   * company-isolation case the recruiter branch used to carry.
   */
  it('never returns the matches of another candidate', async () => {
    const alice = await createUser('candidate');
    const bob = await createUser('candidate');
    const recruiter = await seedRecruiterWithCompany('Acme');
    const offer = await prisma.offer.create({
      data: {
        title: 'Développeur Front',
        status: 'open',
        companyId: recruiter.company.id,
        createdById: recruiter.user.id,
      },
    });
    const aliceMatch = await prisma.match.create({
      data: { candidateUserId: alice.id, offerId: offer.id },
    });
    await prisma.match.create({
      data: { candidateUserId: bob.id, offerId: offer.id },
    });

    const res = await httpRequest(app)
      .get('/api/matches')
      .set('Authorization', bearerFor(app, alice.id, 'candidate'))
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect((res.body as { id: number }[])[0].id).toBe(aliceMatch.id);
  });

  it('hides matches for a candidate when the offer is no longer open', async () => {
    const candidate = await createUser('candidate');
    const recruiter = await seedRecruiterWithCompany('Acme');
    const openOffer = await prisma.offer.create({
      data: {
        title: 'Développeur Front',
        status: 'open',
        companyId: recruiter.company.id,
        createdById: recruiter.user.id,
      },
    });
    const draftOffer = await prisma.offer.create({
      data: {
        title: 'Offre interne',
        status: 'draft',
        companyId: recruiter.company.id,
        createdById: recruiter.user.id,
      },
    });
    const visibleMatch = await prisma.match.create({
      data: {
        candidateUserId: candidate.id,
        offerId: openOffer.id,
        recruiterUserId: recruiter.user.id,
      },
    });
    await prisma.match.create({
      data: {
        candidateUserId: candidate.id,
        offerId: draftOffer.id,
        recruiterUserId: recruiter.user.id,
      },
    });

    const res = await httpRequest(app)
      .get('/api/matches?page=1&limit=20')
      .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
      .expect(200);

    expect(res.body).toHaveLength(1);
    const matches = res.body as Array<{ id: number }>;
    expect(matches[0]).toMatchObject({ id: visibleMatch.id });
  });

  /**
   * Same population as `findApplicants` and `/likes/received`, which both
   * already drop these two. Served here, the row carries the surname of a
   * deactivated account and opens a candidate screen they are absent from.
   */
  it('hides deactivated and profile-less candidates from the recruiter list', async () => {
    const recruiter = await seedRecruiterWithCompany('Acme');
    const offer = await prisma.offer.create({
      data: { title: 'Own', status: 'open', companyId: recruiter.company.id },
    });

    const visible = await createUser('candidate');
    await prisma.candidateProfile.create({
      data: { userId: visible.id, firstName: 'Ada', lastName: 'Lovelace' },
    });
    const disabled = await createUser('candidate');
    await prisma.candidateProfile.create({
      data: { userId: disabled.id, firstName: 'Zoe', lastName: 'Disabled' },
    });
    await prisma.user.update({
      where: { id: disabled.id },
      data: { isActive: false },
    });
    const profileless = await createUser('candidate');

    const visibleMatch = await prisma.match.create({
      data: { candidateUserId: visible.id, offerId: offer.id },
    });
    for (const candidateUserId of [disabled.id, profileless.id]) {
      await prisma.match.create({
        data: { candidateUserId, offerId: offer.id },
      });
    }

    const res = await httpRequest(app)
      .get('/api/matches')
      .set('Authorization', bearerFor(app, recruiter.user.id, 'recruiter'))
      .expect(200);

    const body = res.body as Array<{
      id: number;
      counterpart: { id: number; name: string };
    }>;
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: visibleMatch.id,
      counterpart: { id: visible.id, name: 'Ada Lovelace' },
    });
  });

  describe('DELETE /matches/:id', () => {
    /**
     * A pair in the state the endpoint has to undo: both likes written, the
     * match standing on them. Seeded through Prisma rather than through the
     * two like endpoints so the teardown is observed on its own, without a
     * throttler or a swipe flow in the way.
     */
    const seedMatchedPair = async () => {
      const recruiter = await seedRecruiterWithCompany('Acme');
      const candidate = await createUser('candidate');
      await prisma.candidateProfile.create({
        data: { userId: candidate.id, firstName: 'Ada', lastName: 'Lovelace' },
      });
      const offer = await prisma.offer.create({
        data: {
          title: 'Développeur Full-Stack',
          status: 'open',
          companyId: recruiter.company.id,
          createdById: recruiter.user.id,
        },
      });
      await prisma.candidateLikesOffer.create({
        data: { candidateUserId: candidate.id, offerId: offer.id },
      });
      await prisma.recruiterLikesCandidate.create({
        data: {
          recruiterUserId: recruiter.user.id,
          candidateUserId: candidate.id,
          offerId: offer.id,
        },
      });
      const match = await prisma.match.create({
        data: {
          candidateUserId: candidate.id,
          offerId: offer.id,
          recruiterUserId: recruiter.user.id,
        },
      });
      return { recruiter, candidate, offer, match };
    };

    /**
     * Everything the row was hiding has to stay hidden. `/likes/sent` and
     * `/likes/received` exclude a pair by the existence of the match, so
     * deleting it alone republishes the withdrawn application on both screens
     * — the surviving likes are what would resurrect it, and the passes are
     * what keeps the offer out of the deck the pair just left.
     */
    it('lets the candidate end the match and leaves no trace of the pair', async () => {
      const { recruiter, candidate, offer, match } = await seedMatchedPair();

      await httpRequest(app)
        .delete(`/api/matches/${match.id}`)
        .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
        .expect(204);

      const candidateMatches = await httpRequest(app)
        .get('/api/matches')
        .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
        .expect(200);
      expect(candidateMatches.body).toEqual([]);

      const recruiterMatches = await httpRequest(app)
        .get('/api/matches')
        .set('Authorization', bearerFor(app, recruiter.user.id, 'recruiter'))
        .expect(200);
      expect(recruiterMatches.body).toEqual([]);

      const feed = await httpRequest(app)
        .get('/api/offers/feed')
        .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
        .expect(200);
      expect(feed.body as Array<{ id: number }>).not.toContainEqual(
        expect.objectContaining({ id: offer.id }),
      );

      const applicants = await httpRequest(app)
        .get(`/api/offers/${offer.id}/likes`)
        .set('Authorization', bearerFor(app, recruiter.user.id, 'recruiter'))
        .expect(200);
      expect(applicants.body).toEqual([]);

      const received = await httpRequest(app)
        .get('/api/likes/received')
        .set('Authorization', bearerFor(app, recruiter.user.id, 'recruiter'))
        .expect(200);
      expect(received.body).toEqual([]);

      const sent = await httpRequest(app)
        .get('/api/likes/sent')
        .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
        .expect(200);
      expect(sent.body).toEqual([]);
    });

    /**
     * The symmetric half: a match is a mutual commitment, so the recruiter
     * ends it on exactly the same terms and with the same teardown.
     */
    it('lets a recruiter of the company end the match with the same teardown', async () => {
      const { recruiter, candidate, offer, match } = await seedMatchedPair();

      await httpRequest(app)
        .delete(`/api/matches/${match.id}`)
        .set('Authorization', bearerFor(app, recruiter.user.id, 'recruiter'))
        .expect(204);

      const recruiterMatches = await httpRequest(app)
        .get('/api/matches')
        .set('Authorization', bearerFor(app, recruiter.user.id, 'recruiter'))
        .expect(200);
      expect(recruiterMatches.body).toEqual([]);

      const candidateMatches = await httpRequest(app)
        .get('/api/matches')
        .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
        .expect(200);
      expect(candidateMatches.body).toEqual([]);

      const feed = await httpRequest(app)
        .get('/api/offers/feed')
        .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
        .expect(200);
      expect(feed.body as Array<{ id: number }>).not.toContainEqual(
        expect.objectContaining({ id: offer.id }),
      );

      const applicants = await httpRequest(app)
        .get(`/api/offers/${offer.id}/likes`)
        .set('Authorization', bearerFor(app, recruiter.user.id, 'recruiter'))
        .expect(200);
      expect(applicants.body).toEqual([]);

      const received = await httpRequest(app)
        .get('/api/likes/received')
        .set('Authorization', bearerFor(app, recruiter.user.id, 'recruiter'))
        .expect(200);
      expect(received.body).toEqual([]);
    });

    /**
     * The tenant axis, observed rather than mocked. Both third parties hold a
     * valid token of the right role, so nothing but the scope check stands
     * between them and someone else's match — and a 403 would already tell
     * them the id exists.
     */
    it('answers 404 to a third party and leaves the match standing', async () => {
      const { recruiter, candidate, match } = await seedMatchedPair();
      const stranger = await createUser('candidate');
      const otherCompany = await seedRecruiterWithCompany('Globex');

      for (const authorization of [
        bearerFor(app, stranger.id, 'candidate'),
        bearerFor(app, otherCompany.user.id, 'recruiter'),
      ]) {
        await httpRequest(app)
          .delete(`/api/matches/${match.id}`)
          .set('Authorization', authorization)
          .expect(404);
      }

      const candidateMatches = await httpRequest(app)
        .get('/api/matches')
        .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
        .expect(200);
      expect(candidateMatches.body).toHaveLength(1);

      const recruiterMatches = await httpRequest(app)
        .get('/api/matches')
        .set('Authorization', bearerFor(app, recruiter.user.id, 'recruiter'))
        .expect(200);
      expect(recruiterMatches.body).toHaveLength(1);
    });

    it('rejects an unauthenticated deletion with 401', async () => {
      const { match } = await seedMatchedPair();

      await httpRequest(app).delete(`/api/matches/${match.id}`).expect(401);

      expect(await prisma.match.count()).toBe(1);
    });

    /**
     * No 409 and no tombstone: the row is gone, so the second call is an
     * unknown id like any other. The client reads that 404 as « already
     * removed » and drops the line anyway, which is what makes a double tap or
     * a retry harmless.
     */
    it('answers 404 on a second deletion of the same match', async () => {
      const { candidate, match } = await seedMatchedPair();
      const authorization = bearerFor(app, candidate.id, 'candidate');

      await httpRequest(app)
        .delete(`/api/matches/${match.id}`)
        .set('Authorization', authorization)
        .expect(204);
      await httpRequest(app)
        .delete(`/api/matches/${match.id}`)
        .set('Authorization', authorization)
        .expect(404);
    });
  });
});
