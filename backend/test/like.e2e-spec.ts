import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup-app';
import { bearerFor } from './auth-header';
import { httpRequest } from './http-client';
import { resetDb } from './reset-db';
import { resetThrottler } from './throttler-reset';

type LikeListItem = {
  offerId: number;
  candidateUserId: number | null;
  likedAt: string;
  offer: { id: number; title: string };
  counterpart: {
    kind: string;
    id: number;
    name: string;
    avatarUrl: string | null;
    headline: string | null;
  };
};

describe('Like (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const createUser = (userType: 'candidate' | 'recruiter', isActive = true) =>
    prisma.user.create({
      data: {
        email: [userType, Date.now(), Math.random()].join('-') + '@test.dev',
        passwordHash: 'x',
        userType,
        isActive,
      },
    });

  const seedCandidate = async (firstName: string, isActive = true) => {
    const user = await createUser('candidate', isActive);
    await prisma.candidateProfile.create({
      data: {
        userId: user.id,
        firstName,
        lastName: 'Lovelace',
        desiredJobTitle: 'Développeuse',
      },
    });
    return user;
  };

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

  const seedOffer = (companyId: number, title: string, status = 'open') =>
    prisma.offer.create({
      data: { title, status: status as 'open', companyId },
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(prisma);
    resetThrottler(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authorisation', () => {
    it('rejects anonymous reads with 401', async () => {
      await httpRequest(app).get('/api/likes/sent').expect(401);
      await httpRequest(app).get('/api/likes/received').expect(401);
    });

    it('refuses a candidate on the recruiter list and a recruiter on the candidate list', async () => {
      const candidate = await seedCandidate('Ada');
      const recruiter = await seedRecruiterWithCompany('Acme');

      await httpRequest(app)
        .get('/api/likes/received')
        .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
        .expect(403);
      await httpRequest(app)
        .get('/api/likes/sent')
        .set('Authorization', bearerFor(app, recruiter.user.id, 'recruiter'))
        .expect(403);
    });
  });

  describe('GET /likes/sent', () => {
    it('answers 200 and an empty array when the candidate liked nothing', async () => {
      const candidate = await seedCandidate('Ada');

      const res = await httpRequest(app)
        .get('/api/likes/sent')
        .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
        .expect(200);

      expect(res.body).toEqual([]);
    });

    /**
     * The three exclusions in one fixture: only the pending like on an open
     * offer is an actionable one for the candidate.
     */
    it('keeps the pending like and drops the matched and the closed offers', async () => {
      const candidate = await seedCandidate('Ada');
      const acme = await seedRecruiterWithCompany('Acme');
      const pending = await seedOffer(acme.company.id, 'Pending');
      const matched = await seedOffer(acme.company.id, 'Matched');
      const draft = await seedOffer(acme.company.id, 'Draft', 'draft');
      await prisma.candidateLikesOffer.createMany({
        data: [pending, matched, draft].map((offer) => ({
          candidateUserId: candidate.id,
          offerId: offer.id,
        })),
      });
      await prisma.match.create({
        data: { candidateUserId: candidate.id, offerId: matched.id },
      });

      const res = await httpRequest(app)
        .get('/api/likes/sent')
        .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
        .expect(200);

      const items = res.body as LikeListItem[];
      expect(items).toHaveLength(1);
      const { likedAt, ...item } = items[0];
      expect(item).toEqual({
        offerId: pending.id,
        candidateUserId: null,
        offer: { id: pending.id, title: 'Pending' },
        counterpart: {
          kind: 'company',
          id: acme.company.id,
          name: 'Acme',
          avatarUrl: null,
          headline: 'Pending',
        },
      });
      expect(likedAt).toEqual(expect.any(String));
    });

    it('never exposes another candidate’s likes', async () => {
      const alice = await seedCandidate('Alice');
      const bob = await seedCandidate('Bob');
      const acme = await seedRecruiterWithCompany('Acme');
      const offer = await seedOffer(acme.company.id, 'Shared');
      await prisma.candidateLikesOffer.createMany({
        data: [
          { candidateUserId: alice.id, offerId: offer.id },
          { candidateUserId: bob.id, offerId: offer.id },
        ],
      });

      const res = await httpRequest(app)
        .get('/api/likes/sent')
        .set('Authorization', bearerFor(app, alice.id, 'candidate'))
        .expect(200);

      expect(res.body).toHaveLength(1);
    });
  });

  describe('GET /likes/received', () => {
    it('answers 200 and an empty array when nobody liked the company offers', async () => {
      const acme = await seedRecruiterWithCompany('Acme');
      await seedOffer(acme.company.id, 'Lonely');

      const res = await httpRequest(app)
        .get('/api/likes/received')
        .set('Authorization', bearerFor(app, acme.user.id, 'recruiter'))
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('exposes the candidate behind a pending like', async () => {
      const acme = await seedRecruiterWithCompany('Acme');
      const candidate = await seedCandidate('Ada');
      const offer = await seedOffer(acme.company.id, 'Développeur Front');
      await prisma.candidateLikesOffer.create({
        data: { candidateUserId: candidate.id, offerId: offer.id },
      });

      const res = await httpRequest(app)
        .get('/api/likes/received')
        .set('Authorization', bearerFor(app, acme.user.id, 'recruiter'))
        .expect(200);

      const items = res.body as LikeListItem[];
      expect(items).toHaveLength(1);
      const { likedAt, ...item } = items[0];
      expect(item).toEqual({
        offerId: offer.id,
        candidateUserId: candidate.id,
        offer: { id: offer.id, title: 'Développeur Front' },
        counterpart: {
          kind: 'candidate',
          id: candidate.id,
          name: 'Ada',
          avatarUrl: null,
          headline: 'Développeuse',
        },
      });
      expect(likedAt).toEqual(expect.any(String));
    });

    /**
     * The scope is the company, not the offer's creator: a recruiter of
     * company B must not read a like addressed to company A.
     */
    it('never returns a like addressed to another company', async () => {
      const acme = await seedRecruiterWithCompany('Acme');
      const globex = await seedRecruiterWithCompany('Globex');
      const candidate = await seedCandidate('Ada');
      const acmeOffer = await seedOffer(acme.company.id, 'Acme Front');
      await prisma.candidateLikesOffer.create({
        data: { candidateUserId: candidate.id, offerId: acmeOffer.id },
      });

      const res = await httpRequest(app)
        .get('/api/likes/received')
        .set('Authorization', bearerFor(app, globex.user.id, 'recruiter'))
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('drops the matched, the passed, the profileless and the deactivated candidates', async () => {
      const acme = await seedRecruiterWithCompany('Acme');
      const offer = await seedOffer(acme.company.id, 'Développeur Front');
      const pending = await seedCandidate('Pending');
      const matched = await seedCandidate('Matched');
      const passed = await seedCandidate('Passed');
      const deactivated = await seedCandidate('Deactivated', false);
      const profileless = await createUser('candidate');
      await prisma.candidateLikesOffer.createMany({
        data: [pending, matched, passed, deactivated, profileless].map(
          (user) => ({ candidateUserId: user.id, offerId: offer.id }),
        ),
      });
      await prisma.match.create({
        data: { candidateUserId: matched.id, offerId: offer.id },
      });
      await prisma.recruiterPassesCandidate.create({
        data: {
          recruiterUserId: acme.user.id,
          candidateUserId: passed.id,
          offerId: offer.id,
        },
      });

      const res = await httpRequest(app)
        .get('/api/likes/received')
        .set('Authorization', bearerFor(app, acme.user.id, 'recruiter'))
        .expect(200);

      const items = res.body as LikeListItem[];
      expect(items).toHaveLength(1);
      expect(items[0]?.candidateUserId).toBe(pending.id);
    });

    /**
     * A pass is the caller's own decision: a colleague of the same company
     * still has the candidate to answer.
     */
    it('keeps a candidate passed by another recruiter of the same company', async () => {
      const acme = await seedRecruiterWithCompany('Acme');
      const colleague = await createUser('recruiter');
      await prisma.recruiterProfile.create({
        data: {
          userId: colleague.id,
          companyId: acme.company.id,
          firstName: 'C',
          lastName: 'D',
        },
      });
      const candidate = await seedCandidate('Ada');
      const offer = await seedOffer(acme.company.id, 'Développeur Front');
      await prisma.candidateLikesOffer.create({
        data: { candidateUserId: candidate.id, offerId: offer.id },
      });
      await prisma.recruiterPassesCandidate.create({
        data: {
          recruiterUserId: colleague.id,
          candidateUserId: candidate.id,
          offerId: offer.id,
        },
      });

      const res = await httpRequest(app)
        .get('/api/likes/received')
        .set('Authorization', bearerFor(app, acme.user.id, 'recruiter'))
        .expect(200);

      expect(res.body).toHaveLength(1);
    });

    /**
     * The counterpart of a pending like is a first name: the surname comes
     * with the match, not with the interest. Asserted over the whole payload
     * rather than over `counterpart.name`, so that a surname reappearing in
     * any other field fails too.
     */
    it('withholds the surname of every candidate until the match', async () => {
      const acme = await seedRecruiterWithCompany('Acme');
      const ada = await seedCandidate('Ada');
      const grace = await seedCandidate('Grace');
      const offer = await seedOffer(acme.company.id, 'Développeur Front');
      await prisma.candidateLikesOffer.createMany({
        data: [ada, grace].map((user) => ({
          candidateUserId: user.id,
          offerId: offer.id,
        })),
      });

      const res = await httpRequest(app)
        .get('/api/likes/received')
        .set('Authorization', bearerFor(app, acme.user.id, 'recruiter'))
        .expect(200);

      const items = res.body as LikeListItem[];
      expect(items.map((item) => item.counterpart.name).sort()).toEqual([
        'Ada',
        'Grace',
      ]);
      expect(JSON.stringify(res.body)).not.toContain('Lovelace');
    });

    it('exposes no email, phone or account column', async () => {
      const acme = await seedRecruiterWithCompany('Acme');
      const candidate = await seedCandidate('Ada');
      const offer = await seedOffer(acme.company.id, 'Développeur Front');
      await prisma.candidateLikesOffer.create({
        data: { candidateUserId: candidate.id, offerId: offer.id },
      });

      const res = await httpRequest(app)
        .get('/api/likes/received')
        .set('Authorization', bearerFor(app, acme.user.id, 'recruiter'))
        .expect(200);

      const items = res.body as LikeListItem[];
      expect(Object.keys(items[0] ?? {}).sort()).toEqual([
        'candidateUserId',
        'counterpart',
        'likedAt',
        'offer',
        'offerId',
      ]);
      expect(Object.keys(items[0]?.counterpart ?? {}).sort()).toEqual([
        'avatarUrl',
        'headline',
        'id',
        'kind',
        'name',
      ]);
      const payload = JSON.stringify(res.body);
      expect(payload).not.toContain(candidate.email);
      expect(payload).not.toContain('passwordHash');
      expect(payload).not.toContain('isActive');
      expect(payload).not.toContain('phone');
    });
  });

  describe('pagination', () => {
    it('honours page and limit', async () => {
      const acme = await seedRecruiterWithCompany('Acme');
      const candidate = await seedCandidate('Ada');
      const first = await seedOffer(acme.company.id, 'First');
      const second = await seedOffer(acme.company.id, 'Second');
      await prisma.candidateLikesOffer.create({
        data: {
          candidateUserId: candidate.id,
          offerId: first.id,
          likedAt: new Date('2026-08-18T10:00:00.000Z'),
        },
      });
      await prisma.candidateLikesOffer.create({
        data: {
          candidateUserId: candidate.id,
          offerId: second.id,
          likedAt: new Date('2026-08-19T10:00:00.000Z'),
        },
      });

      const token = bearerFor(app, candidate.id, 'candidate');
      const page1 = await httpRequest(app)
        .get('/api/likes/sent?page=1&limit=1')
        .set('Authorization', token)
        .expect(200);
      const page2 = await httpRequest(app)
        .get('/api/likes/sent?page=2&limit=1')
        .set('Authorization', token)
        .expect(200);

      expect((page1.body as LikeListItem[])[0]?.offerId).toBe(second.id);
      expect((page2.body as LikeListItem[])[0]?.offerId).toBe(first.id);
    });

    /**
     * `Number.isInteger(1e30)` is true, so the floor alone lets a page through
     * whose offset no longer fits an int4 — and that surfaces as a 500 instead
     * of the 400 a bad parameter deserves.
     */
    it('rejects a page above what the database can offset', async () => {
      const candidate = await seedCandidate('Ada');
      const recruiter = await seedRecruiterWithCompany('Acme');

      await httpRequest(app)
        .get('/api/likes/sent?page=1e30')
        .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
        .expect(400);
      await httpRequest(app)
        .get('/api/likes/received?page=1e30')
        .set('Authorization', bearerFor(app, recruiter.user.id, 'recruiter'))
        .expect(400);
    });

    it('rejects a limit outside its bounds', async () => {
      const candidate = await seedCandidate('Ada');
      const recruiter = await seedRecruiterWithCompany('Acme');
      const candidateToken = bearerFor(app, candidate.id, 'candidate');
      const recruiterToken = bearerFor(app, recruiter.user.id, 'recruiter');

      await httpRequest(app)
        .get('/api/likes/sent?limit=0')
        .set('Authorization', candidateToken)
        .expect(400);
      await httpRequest(app)
        .get('/api/likes/sent?limit=101')
        .set('Authorization', candidateToken)
        .expect(400);
      await httpRequest(app)
        .get('/api/likes/received?limit=0')
        .set('Authorization', recruiterToken)
        .expect(400);
      await httpRequest(app)
        .get('/api/likes/received?limit=101')
        .set('Authorization', recruiterToken)
        .expect(400);
    });
  });
});
