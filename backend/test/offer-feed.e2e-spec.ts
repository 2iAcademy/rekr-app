import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import {
  ContractType,
  ExperienceLevel,
  OfferStatus,
  RemotePolicy,
} from '../generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup-app';
import { bearerFor } from './auth-header';
import { httpRequest } from './http-client';
import { resetDb } from './reset-db';
import { resetThrottler } from './throttler-reset';
import { stubCityReference } from './city-reference';

type FeedItem = {
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
  company: { id: number; name: string; logo: string | null };
  tags: string[];
};

type OfferOverrides = {
  title?: string;
  description?: string | null;
  status?: OfferStatus;
  city?: string | null;
  contractType?: ContractType | null;
  minExperienceLevel?: ExperienceLevel | null;
  remotePolicy?: RemotePolicy | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  createdAt?: Date;
};

const VITRINE_KEYS = [
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

describe('Offer feed (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let candidate: { id: number; email: string };
  let recruiter: { id: number; email: string };
  let company: { id: number };

  const feedOf = (res: request.Response): FeedItem[] => res.body as FeedItem[];

  const idsOf = (res: request.Response): number[] =>
    feedOf(res).map((offer) => offer.id);

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
    const created = await prisma.company.create({
      data: { name, logo: 'companies/1/logo/acme.webp' },
    });
    await prisma.recruiterProfile.create({
      data: {
        userId: user.id,
        companyId: created.id,
        firstName: 'R',
        lastName: 'D',
      },
    });
    return { user, company: created };
  };

  const seedOffer = (overrides: OfferOverrides = {}) =>
    prisma.offer.create({
      data: {
        title: 'Développeur Front',
        description: 'Belle mission.',
        status: 'open',
        city: 'Lyon',
        contractType: 'CDI',
        minExperienceLevel: 'CONFIRME',
        remotePolicy: 'HYBRID',
        salaryMin: 45000,
        salaryMax: 60000,
        companyId: company.id,
        createdById: recruiter.id,
        ...overrides,
      },
    });

  const getFeed = (query = '') =>
    httpRequest(app)
      .get(`/api/offers/feed${query}`)
      .set('Authorization', bearerFor(app, candidate.id, 'candidate'));

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
    stubCityReference();

    candidate = await createUser('candidate');
    const seeded = await seedRecruiterWithCompany('Acme');
    recruiter = seeded.user;
    company = seeded.company;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('access', () => {
    it('rejects an unauthenticated read with 401', async () => {
      await seedOffer();

      await httpRequest(app).get('/api/offers/feed').expect(401);
    });

    it('forbids a recruiter from reading the offer feed (403)', async () => {
      await seedOffer();

      await httpRequest(app)
        .get('/api/offers/feed')
        .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
        .expect(403);
    });

    it('returns an array to a candidate', async () => {
      await seedOffer();

      const res = await getFeed().expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
    });

    // The trap this path introduces: `feed` sits under the same prefix as
    // `@Get(':id')`, so declaring it after that route would hand « feed » to
    // the ParseIntPipe and answer 400. The declaration order in the controller
    // is load-bearing, and this is what holds it.
    it('does not let the :id route swallow /feed', async () => {
      await seedOffer();

      const res = await getFeed();

      expect(res.status).not.toBe(400);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    // `feed` is a literal segment sitting under the same prefix as the `:id`
    // detail route; both have to stay reachable side by side.
    it('leaves the detail route reachable next to the feed', async () => {
      const offer = await seedOffer();

      const res = await httpRequest(app)
        .get(`/api/offers/${offer.id}`)
        .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
        .expect(200);

      expect((res.body as { id: number }).id).toBe(offer.id);
    });
  });

  describe('payload', () => {
    it('exposes the showcase fields and nothing else', async () => {
      const offer = await seedOffer();
      const tag = await prisma.tag.create({
        data: { label: 'React', category: 'skill' },
      });
      await prisma.offerTag.create({
        data: { offerId: offer.id, tagId: tag.id },
      });

      const res = await getFeed().expect(200);
      const [item] = feedOf(res);

      expect(Object.keys(item).sort()).toEqual(VITRINE_KEYS);
      expect(Object.keys(item.company).sort()).toEqual(['id', 'logo', 'name']);
      expect(item).toMatchObject({
        id: offer.id,
        title: 'Développeur Front',
        description: 'Belle mission.',
        city: 'Lyon',
        contractType: 'CDI',
        minExperienceLevel: 'CONFIRME',
        remotePolicy: 'HYBRID',
        salaryMin: 45000,
        salaryMax: 60000,
        company: { id: company.id, name: 'Acme' },
        tags: ['React'],
      });
    });

    it('leaks no account data, internal key or geolocation', async () => {
      await seedOffer();

      const res = await getFeed().expect(200);
      const [item] = feedOf(res);

      expect(item).not.toHaveProperty('createdById');
      expect(item).not.toHaveProperty('companyId');
      expect(item).not.toHaveProperty('postalCode');
      expect(item).not.toHaveProperty('latitude');
      expect(item).not.toHaveProperty('longitude');
      expect(item).not.toHaveProperty('status');
      expect(item).not.toHaveProperty('updatedAt');
      expect(JSON.stringify(res.body)).not.toContain(recruiter.email);
    });
  });

  describe('selection', () => {
    it('keeps open offers only', async () => {
      const open = await seedOffer({ status: 'open' });
      await seedOffer({ status: 'draft' });
      await seedOffer({ status: 'paused' });
      await seedOffer({ status: 'filled' });
      await seedOffer({ status: 'closed' });

      const res = await getFeed().expect(200);

      expect(idsOf(res)).toEqual([open.id]);
    });

    it('hides an offer the candidate already liked', async () => {
      const liked = await seedOffer();
      const untouched = await seedOffer();
      await prisma.candidateLikesOffer.create({
        data: { candidateUserId: candidate.id, offerId: liked.id },
      });

      const res = await getFeed().expect(200);

      expect(idsOf(res)).toEqual([untouched.id]);
    });

    it('hides an offer the candidate already passed', async () => {
      const passed = await seedOffer();
      const untouched = await seedOffer();
      await prisma.candidatePassesOffer.create({
        data: { candidateUserId: candidate.id, offerId: passed.id },
      });

      const res = await getFeed().expect(200);

      expect(idsOf(res)).toEqual([untouched.id]);
    });

    it('keeps an offer another candidate liked or passed', async () => {
      const offer = await seedOffer();
      const other = await createUser('candidate');
      await prisma.candidateLikesOffer.create({
        data: { candidateUserId: other.id, offerId: offer.id },
      });
      await prisma.candidatePassesOffer.create({
        data: { candidateUserId: other.id, offerId: offer.id },
      });

      const res = await getFeed().expect(200);

      expect(idsOf(res)).toEqual([offer.id]);
    });
  });

  describe('filters', () => {
    it('filters on the contract type', async () => {
      const cdi = await seedOffer({ contractType: 'CDI' });
      await seedOffer({ contractType: 'FREELANCE' });

      const res = await getFeed('?contractType=CDI').expect(200);

      expect(idsOf(res)).toEqual([cdi.id]);
    });

    it('filters on the minimum experience level', async () => {
      const senior = await seedOffer({ minExperienceLevel: 'SENIOR' });
      await seedOffer({ minExperienceLevel: 'JUNIOR' });

      const res = await getFeed('?experienceLevel=SENIOR').expect(200);

      expect(idsOf(res)).toEqual([senior.id]);
    });

    it('filters on the remote policy', async () => {
      const remote = await seedOffer({ remotePolicy: 'FULL_REMOTE' });
      await seedOffer({ remotePolicy: 'ON_SITE' });

      const res = await getFeed('?remotePolicy=FULL_REMOTE').expect(200);

      expect(idsOf(res)).toEqual([remote.id]);
    });

    it('filters on the city', async () => {
      const lyon = await seedOffer({ city: 'Lyon' });
      await seedOffer({ city: 'Marseille' });

      const res = await getFeed('?city=Lyon').expect(200);

      expect(idsOf(res)).toEqual([lyon.id]);
    });

    it('matches the city whatever the case', async () => {
      const lyon = await seedOffer({ city: 'Lyon' });
      await seedOffer({ city: 'Marseille' });

      const res = await getFeed('?city=lYoN').expect(200);

      expect(idsOf(res)).toEqual([lyon.id]);
    });

    it('combines two filters', async () => {
      const wanted = await seedOffer({
        contractType: 'CDI',
        remotePolicy: 'FULL_REMOTE',
      });
      await seedOffer({ contractType: 'CDI', remotePolicy: 'ON_SITE' });
      await seedOffer({
        contractType: 'FREELANCE',
        remotePolicy: 'FULL_REMOTE',
      });

      const res = await getFeed(
        '?contractType=CDI&remotePolicy=FULL_REMOTE',
      ).expect(200);

      expect(idsOf(res)).toEqual([wanted.id]);
    });
  });

  describe('deck order', () => {
    it('orders by creation date then id, both descending', async () => {
      const oldest = await seedOffer({ createdAt: new Date('2026-01-01') });
      const first = await seedOffer({ createdAt: new Date('2026-02-01') });
      const second = await seedOffer({ createdAt: new Date('2026-02-01') });

      const res = await getFeed().expect(200);

      expect(idsOf(res)).toEqual([
        Math.max(first.id, second.id),
        Math.min(first.id, second.id),
        oldest.id,
      ]);
    });

    // A card answered leaves the deck, so the next read is the rest of it. An
    // offset computed over a set the swipe shrinks jumps over a card: page 1,
    // one pass, page 2 never showed the one in the middle. The deck therefore
    // takes no offset at all.
    it('walks the whole deck one swipe at a time, skipping none', async () => {
      const third = await seedOffer({ createdAt: new Date('2026-01-01') });
      const second = await seedOffer({ createdAt: new Date('2026-02-01') });
      const first = await seedOffer({ createdAt: new Date('2026-03-01') });

      const swiped: number[] = [];
      for (let card = 0; card < 3; card++) {
        const [id] = idsOf(await getFeed('?limit=1').expect(200));
        swiped.push(id);
        await prisma.candidatePassesOffer.create({
          data: { candidateUserId: candidate.id, offerId: id },
        });
      }

      expect(swiped).toEqual([first.id, second.id, third.id]);
      expect(idsOf(await getFeed('?limit=1').expect(200))).toEqual([]);
      await getFeed('?page=2&limit=1').expect(400);
    });
  });

  describe('query validation', () => {
    it('rejects a limit above 100', async () => {
      await getFeed('?limit=101').expect(400);
    });

    it('rejects a filter value outside its enum', async () => {
      await getFeed('?contractType=CDX').expect(400);
    });

    it('rejects an unknown query parameter', async () => {
      await getFeed('?foo=bar').expect(400);
    });
  });
});
