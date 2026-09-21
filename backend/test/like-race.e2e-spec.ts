import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup-app';
import { bearerFor } from './auth-header';
import { httpRequest } from './http-client';
import { resetDb } from './reset-db';
import { resetThrottler } from './throttler-reset';

/**
 * Concurrency, not behaviour: every scenario here fires two requests at once
 * and asserts an invariant the sequential specs already cover in isolation.
 *
 * Two traps make these tests lie when they are written naively.
 *
 * The first is the lazy connect: the very first request of a spec file pays
 * for Prisma's pool warm-up, which serialises the pair and hides the race. A
 * throwaway request therefore precedes every `Promise.all`.
 *
 * The second is chance: an interleaving that loses the race one time in three
 * passes a single run. Each scenario is repeated, on a fresh offer, so that one
 * lucky ordering cannot stand in for a proof. Twenty rounds were not enough —
 * one of the three scenarios survived them before the fix, and only fell on a
 * longer run.
 *
 * What is asserted is never *which* of the two requests wins — nothing orders
 * them, and both orders are legitimate answers. It is the states no serial
 * order could ever have produced.
 */
const ROUNDS = 40;

describe('Like/pass races (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const createUser = (userType: 'candidate' | 'recruiter') =>
    prisma.user.create({
      data: {
        email: [userType, Date.now(), Math.random()].join('-') + '@test.dev',
        passwordHash: 'x',
        userType,
        isActive: true,
      },
    });

  const seedCandidate = async () => {
    const user = await createUser('candidate');
    await prisma.candidateProfile.create({
      data: {
        userId: user.id,
        firstName: 'Ada',
        lastName: 'Lovelace',
        desiredJobTitle: 'Développeuse',
      },
    });
    return user;
  };

  const seedRecruiterWithCompany = async () => {
    const user = await createUser('recruiter');
    const company = await prisma.company.create({
      data: { name: 'Acme ' + Math.random() },
    });
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

  const seedOffer = (companyId: number) =>
    prisma.offer.create({
      data: { title: 'Dev', status: 'open', companyId },
    });

  const warmUp = (auth: string) =>
    httpRequest(app)
      .get('/api/likes/sent')
      .set('Authorization', auth)
      .expect(200);

  const answersOn = async (candidateUserId: number, offerId: number) => {
    const where = { candidateUserId, offerId };
    const [likes, passes, matches] = await Promise.all([
      prisma.candidateLikesOffer.count({ where }),
      prisma.candidatePassesOffer.count({ where }),
      prisma.match.count({ where }),
    ]);
    return { likes, passes, matches };
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

  it('never lets a like and a pass stand on the same pair', async () => {
    const candidate = await seedCandidate();
    const auth = bearerFor(app, candidate.id, 'candidate');
    const acme = await seedRecruiterWithCompany();

    for (let round = 0; round < ROUNDS; round += 1) {
      const offer = await seedOffer(acme.company.id);
      await warmUp(auth);

      await Promise.all([
        httpRequest(app)
          .post(`/api/offers/${offer.id}/like`)
          .set('Authorization', auth),
        httpRequest(app)
          .post(`/api/offers/${offer.id}/pass`)
          .set('Authorization', auth),
      ]);

      const { likes, passes } = await answersOn(candidate.id, offer.id);

      // One answer or the other, never both: each order clears what the other
      // wrote, so their sum is what tells the two apart from a write skew.
      expect({ round, answers: likes + passes }).toEqual({ round, answers: 1 });
    }
  });

  it('never leaves a match standing on a like the candidate withdrew', async () => {
    const candidate = await seedCandidate();
    const auth = bearerFor(app, candidate.id, 'candidate');
    const acme = await seedRecruiterWithCompany();

    for (let round = 0; round < ROUNDS; round += 1) {
      const offer = await seedOffer(acme.company.id);
      await prisma.candidateLikesOffer.create({
        data: { candidateUserId: candidate.id, offerId: offer.id },
      });
      // The recruiter already answered, so the candidate's like is the half
      // that closes the match.
      await prisma.recruiterLikesCandidate.create({
        data: {
          recruiterUserId: acme.user.id,
          candidateUserId: candidate.id,
          offerId: offer.id,
        },
      });
      await warmUp(auth);

      await Promise.all([
        httpRequest(app)
          .post(`/api/offers/${offer.id}/like`)
          .set('Authorization', auth),
        httpRequest(app)
          .delete(`/api/offers/${offer.id}/like`)
          .set('Authorization', auth),
      ]);

      const { likes, matches } = await answersOn(candidate.id, offer.id);

      // Whoever wins, the two rows agree: either the like stands and the match
      // with it, or neither does. A match alone is a candidate engaged on an
      // application they no longer have — and 409 leaves them no way back out.
      expect({ round, matches }).toEqual({ round, matches: likes });
    }
  });

  it('never matches a candidate the recruiter answered as they withdrew', async () => {
    const candidate = await seedCandidate();
    const candidateAuth = bearerFor(app, candidate.id, 'candidate');
    const acme = await seedRecruiterWithCompany();
    const recruiterAuth = bearerFor(app, acme.user.id, 'recruiter');

    for (let round = 0; round < ROUNDS; round += 1) {
      const offer = await seedOffer(acme.company.id);
      await prisma.candidateLikesOffer.create({
        data: { candidateUserId: candidate.id, offerId: offer.id },
      });
      await warmUp(candidateAuth);

      await Promise.all([
        httpRequest(app)
          .delete(`/api/offers/${offer.id}/like`)
          .set('Authorization', candidateAuth),
        httpRequest(app)
          .post(`/api/offers/${offer.id}/likes/${candidate.id}`)
          .set('Authorization', recruiterAuth),
      ]);

      const { likes, matches } = await answersOn(candidate.id, offer.id);

      // Same invariant, reached from the recruiter's side: the withdrawal
      // either happened before the answer, and there is no match, or after it,
      // and 409 kept the like in place.
      expect({ round, matches }).toEqual({ round, matches: likes });
    }
  });
});
