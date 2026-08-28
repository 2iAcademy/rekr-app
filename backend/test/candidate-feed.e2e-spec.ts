import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import {
  Availability,
  ContractType,
  ExperienceLevel,
  Prisma,
  RemotePolicy,
} from '../generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup-app';
import { bearerFor } from './auth-header';
import { stubCityReference } from './city-reference';
import { resetCityCache } from './city-cache-reset';
import { httpRequest } from './http-client';
import { resetDb } from './reset-db';
import { resetThrottler } from './throttler-reset';

interface FeedItem {
  userId: number;
  firstName: string;
  picture: string | null;
  bio: string | null;
  city: string | null;
  desiredJobTitle: string | null;
  contractTypes: ContractType[];
  experienceLevel: ExperienceLevel | null;
  availability: Availability | null;
  remotePolicy: RemotePolicy | null;
  tags: string[];
}

const FEED_KEYS = [
  'availability',
  'bio',
  'city',
  'contractTypes',
  'desiredJobTitle',
  'experienceLevel',
  'firstName',
  'picture',
  'remotePolicy',
  'tags',
  'userId',
];

describe('Candidate feed (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const createUser = (userType: 'candidate' | 'recruiter', isActive = true) =>
    prisma.user.create({
      data: {
        email: `${userType}-${Date.now()}-${Math.random()}@test.dev`,
        passwordHash: 'x',
        userType,
        isActive,
      },
    });

  const seedRecruiter = async () => {
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
    return user;
  };

  const seedCandidate = async (
    profile: Partial<Prisma.CandidateProfileUncheckedCreateInput> = {},
    { isActive = true }: { isActive?: boolean } = {},
  ) => {
    const user = await createUser('candidate', isActive);
    await prisma.candidateProfile.create({
      data: {
        userId: user.id,
        firstName: 'Ada',
        lastName: 'Lovelace',
        ...profile,
      },
    });
    return user;
  };

  const getFeed = (recruiterId: number, query = '') =>
    httpRequest(app)
      .get(`/api/candidate-profiles/feed${query}`)
      .set('Authorization', bearerFor(app, recruiterId, 'recruiter'));

  const itemsOf = (body: unknown): FeedItem[] => body as FeedItem[];

  const userIdsOf = (body: unknown): number[] =>
    itemsOf(body).map((item) => item.userId);

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

  it('rejects an unauthenticated read with 401', async () => {
    await httpRequest(app).get('/api/candidate-profiles/feed').expect(401);
  });

  it('forbids a candidate from reading the candidate feed (403)', async () => {
    const candidate = await seedCandidate();

    await httpRequest(app)
      .get('/api/candidate-profiles/feed')
      .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
      .expect(403);
  });

  it('returns an array to a recruiter', async () => {
    const recruiter = await seedRecruiter();
    const candidate = await seedCandidate({ firstName: 'Grace' });

    const res = await getFeed(recruiter.id).expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(userIdsOf(res.body)).toEqual([candidate.id]);
  });

  // `feed` and `me` are two literal segments under the same prefix. The deck
  // and a candidate's own profile must never answer for each other.
  it('does not confuse /feed with the /me routes', async () => {
    const recruiter = await seedRecruiter();
    const candidate = await seedCandidate({ firstName: 'Grace' });

    const feed = await getFeed(recruiter.id).expect(200);

    expect(Array.isArray(feed.body)).toBe(true);
    expect(userIdsOf(feed.body)).toEqual([candidate.id]);

    const mine = await httpRequest(app)
      .get('/api/candidate-profiles/me')
      .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
      .expect(200);

    expect(Array.isArray(mine.body)).toBe(false);
    expect((mine.body as { firstName: string }).firstName).toBe('Grace');
  });

  // The deck left the collection root so that root stays free for the
  // collection itself; serving the feed from both would be the collision this
  // move exists to avoid.
  it('no longer serves the feed from the collection root', async () => {
    const recruiter = await seedRecruiter();
    await seedCandidate({ firstName: 'Grace' });

    await httpRequest(app)
      .get('/api/candidate-profiles')
      .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
      .expect(404);
  });

  it('still serves a candidate their own profile on /me', async () => {
    const candidate = await seedCandidate({ firstName: 'Grace' });

    const res = await httpRequest(app)
      .get('/api/candidate-profiles/me')
      .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
      .expect(200);

    expect((res.body as { firstName: string }).firstName).toBe('Grace');
  });

  it('exposes the showcase fields only', async () => {
    const recruiter = await seedRecruiter();
    const candidate = await seedCandidate({
      firstName: 'Grace',
      lastName: 'Hopper',
      picture: 'candidates/1/picture/a.webp',
      bio: 'Amirale du COBOL.',
      city: 'Lyon',
      postalCode: '69001',
      latitude: new Prisma.Decimal('45.7578137'),
      longitude: new Prisma.Decimal('4.8320114'),
      desiredJobTitle: 'Développeuse',
      contractTypes: ['CDI'],
      experienceLevel: 'SENIOR',
      availability: 'IMMEDIATE',
      availabilityDelayMonths: 3,
      remotePolicy: 'HYBRID',
      mobilityRadiusKm: 30,
      salaryMin: 45000,
      salaryMax: 60000,
      linkedinUrl: 'https://linkedin.test/grace',
      cvUrl: 'candidates/1/cv/a.pdf',
    });

    const tag = await prisma.tag.create({
      data: { label: 'COBOL', category: 'skill' },
    });
    await prisma.candidateTag.create({
      data: { candidateUserId: candidate.id, tagId: tag.id },
    });

    const res = await getFeed(recruiter.id).expect(200);
    const [item] = itemsOf(res.body);

    expect(Object.keys(item).sort()).toEqual(FEED_KEYS);
    expect(item).toMatchObject({
      userId: candidate.id,
      firstName: 'Grace',
      picture: 'candidates/1/picture/a.webp',
      bio: 'Amirale du COBOL.',
      city: 'Lyon',
      desiredJobTitle: 'Développeuse',
      contractTypes: ['CDI'],
      experienceLevel: 'SENIOR',
      availability: 'IMMEDIATE',
      remotePolicy: 'HYBRID',
      tags: ['COBOL'],
    });

    const serialized = JSON.stringify(item);
    expect(serialized).not.toContain('Hopper');
    expect(serialized).not.toContain('69001');
    expect(serialized).not.toContain('45000');
    expect(serialized).not.toContain('linkedin.test');
    expect(serialized).not.toContain('cv/a.pdf');
  });

  it('hides a candidate whose account is deactivated', async () => {
    const recruiter = await seedRecruiter();
    const active = await seedCandidate({ firstName: 'Grace' });
    await seedCandidate({ firstName: 'Ghost' }, { isActive: false });

    const res = await getFeed(recruiter.id).expect(200);

    expect(userIdsOf(res.body)).toEqual([active.id]);
  });

  it('hides a candidate this recruiter already liked', async () => {
    const recruiter = await seedRecruiter();
    const liked = await seedCandidate({ firstName: 'Liked' });
    const fresh = await seedCandidate({ firstName: 'Fresh' });
    await prisma.recruiterLikesCandidate.create({
      data: { recruiterUserId: recruiter.id, candidateUserId: liked.id },
    });

    const res = await getFeed(recruiter.id).expect(200);

    expect(userIdsOf(res.body)).toEqual([fresh.id]);
  });

  it('hides a candidate this recruiter already passed', async () => {
    const recruiter = await seedRecruiter();
    const passed = await seedCandidate({ firstName: 'Passed' });
    const fresh = await seedCandidate({ firstName: 'Fresh' });
    await prisma.recruiterPassesCandidate.create({
      data: { recruiterUserId: recruiter.id, candidateUserId: passed.id },
    });

    const res = await getFeed(recruiter.id).expect(200);

    expect(userIdsOf(res.body)).toEqual([fresh.id]);
  });

  it("keeps a candidate another recruiter passed on this recruiter's deck", async () => {
    const recruiter = await seedRecruiter();
    const other = await seedRecruiter();
    const candidate = await seedCandidate({ firstName: 'Grace' });
    await prisma.recruiterPassesCandidate.create({
      data: { recruiterUserId: other.id, candidateUserId: candidate.id },
    });

    const res = await getFeed(recruiter.id).expect(200);

    expect(userIdsOf(res.body)).toEqual([candidate.id]);
  });

  it('filters on one of several contract types', async () => {
    const recruiter = await seedRecruiter();
    const multi = await seedCandidate({
      firstName: 'Multi',
      contractTypes: ['CDD', 'FREELANCE'],
    });
    await seedCandidate({ firstName: 'Cdi', contractTypes: ['CDI'] });

    const res = await getFeed(recruiter.id, '?contractType=FREELANCE').expect(
      200,
    );

    expect(userIdsOf(res.body)).toEqual([multi.id]);
  });

  it('filters on the experience level', async () => {
    const recruiter = await seedRecruiter();
    const senior = await seedCandidate({ experienceLevel: 'SENIOR' });
    await seedCandidate({ experienceLevel: 'JUNIOR' });

    const res = await getFeed(recruiter.id, '?experienceLevel=SENIOR').expect(
      200,
    );

    expect(userIdsOf(res.body)).toEqual([senior.id]);
  });

  it('filters on the availability', async () => {
    const recruiter = await seedRecruiter();
    const immediate = await seedCandidate({ availability: 'IMMEDIATE' });
    await seedCandidate({ availability: 'WITHIN_DELAY' });

    const res = await getFeed(recruiter.id, '?availability=IMMEDIATE').expect(
      200,
    );

    expect(userIdsOf(res.body)).toEqual([immediate.id]);
  });

  it('filters on the remote policy', async () => {
    const recruiter = await seedRecruiter();
    const remote = await seedCandidate({ remotePolicy: 'FULL_REMOTE' });
    await seedCandidate({ remotePolicy: 'ON_SITE' });

    const res = await getFeed(recruiter.id, '?remotePolicy=FULL_REMOTE').expect(
      200,
    );

    expect(userIdsOf(res.body)).toEqual([remote.id]);
  });

  it('filters on the city whatever its case', async () => {
    const recruiter = await seedRecruiter();
    const lyon = await seedCandidate({ city: 'Lyon' });
    await seedCandidate({ city: 'Paris' });

    const res = await getFeed(recruiter.id, '?city=lYoN').expect(200);

    expect(userIdsOf(res.body)).toEqual([lyon.id]);
  });

  it('combines two filters', async () => {
    const recruiter = await seedRecruiter();
    const wanted = await seedCandidate({
      city: 'Lyon',
      contractTypes: ['CDI'],
    });
    await seedCandidate({ city: 'Lyon', contractTypes: ['STAGE'] });
    await seedCandidate({ city: 'Paris', contractTypes: ['CDI'] });

    const res = await getFeed(
      recruiter.id,
      '?city=Lyon&contractType=CDI',
    ).expect(200);

    expect(userIdsOf(res.body)).toEqual([wanted.id]);
  });

  // A card answered leaves the deck, so the next read is the rest of it. An
  // offset computed over a set the swipe shrinks jumps over a card: page 1,
  // one pass, page 2 never showed the one in the middle. The deck therefore
  // takes no offset at all.
  it('walks the whole deck one swipe at a time, skipping none', async () => {
    const recruiter = await seedRecruiter();
    const third = await seedCandidate({ firstName: 'Third' });
    const second = await seedCandidate({ firstName: 'Second' });
    const first = await seedCandidate({ firstName: 'First' });

    const swiped: number[] = [];
    for (let card = 0; card < 3; card++) {
      const res = await getFeed(recruiter.id, '?limit=1').expect(200);
      const [userId] = userIdsOf(res.body);
      swiped.push(userId);
      await prisma.recruiterPassesCandidate.create({
        data: { recruiterUserId: recruiter.id, candidateUserId: userId },
      });
    }

    expect(swiped).toEqual([first.id, second.id, third.id]);

    const emptied = await getFeed(recruiter.id, '?limit=1').expect(200);
    expect(userIdsOf(emptied.body)).toEqual([]);
    await getFeed(recruiter.id, '?page=2&limit=1').expect(400);
  });

  it('answers 404 to a recruiter attached to no company', async () => {
    const recruiter = await createUser('recruiter');
    await seedCandidate({ firstName: 'Grace' });

    const res = await getFeed(recruiter.id).expect(404);

    expect((res.body as { message: string }).message).toBe(
      'Recruiter has no company',
    );
  });

  it('rejects a limit above the maximum', async () => {
    const recruiter = await seedRecruiter();
    await getFeed(recruiter.id, '?limit=101').expect(400);
  });

  it('rejects a value outside an enum', async () => {
    const recruiter = await seedRecruiter();
    await getFeed(recruiter.id, '?availability=TOMORROW').expect(400);
  });

  it('rejects an unknown query parameter', async () => {
    const recruiter = await seedRecruiter();
    await getFeed(recruiter.id, '?foo=bar').expect(400);
  });
});
