import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { httpRequest } from './http-client';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup-app';
import { bearerFor } from './auth-header';
import { stubCityReference } from './city-reference';
import { resetDb } from './reset-db';
import { resetCityCache } from './city-cache-reset';
import { resetThrottler } from './throttler-reset';

describe('CandidateProfile (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fetchMock: jest.Mock;

  const createUser = (userType: 'candidate' | 'recruiter' = 'candidate') =>
    prisma.user.create({
      data: {
        email: `${userType}-${Date.now()}-${Math.random()}@test.dev`,
        passwordHash: 'x',
        userType,
      },
    });

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

    fetchMock = stubCityReference();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an unauthenticated create with 401', async () => {
    await httpRequest(app)
      .post('/api/candidate-profiles')
      .send({ firstName: 'Ada', lastName: 'Lovelace' })
      .expect(401);
  });

  it('forbids a recruiter from creating a candidate profile (403)', async () => {
    const recruiter = await createUser('recruiter');

    await httpRequest(app)
      .post('/api/candidate-profiles')
      .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
      .send({ firstName: 'Ada', lastName: 'Lovelace' })
      .expect(403);
  });

  it('creates a profile persisting every matching axis', async () => {
    const user = await createUser('candidate');

    const payload = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      bio: 'Pionnière du calcul.',
      city: 'Lyon',
      postalCode: '69001',
      desiredJobTitle: 'Développeuse Front React',
      contractTypes: ['CDI', 'FREELANCE'],
      experienceLevel: 'CONFIRME',
      availability: 'IMMEDIATE',
      remotePolicy: 'HYBRID',
      mobilityRadiusKm: 30,
      mobilityNationwide: false,
      salaryMin: 45000,
      salaryMax: 60000,
      linkedinUrl: 'https://linkedin.com/in/ada',
    };

    await httpRequest(app)
      .post('/api/candidate-profiles')
      .set('Authorization', bearerFor(app, user.id, 'candidate'))
      .send(payload)
      .expect(201);

    const saved = await prisma.candidateProfile.findUnique({
      where: { userId: user.id },
    });

    expect(saved).toMatchObject({
      userId: user.id,
      firstName: 'Ada',
      lastName: 'Lovelace',
      city: 'Lyon',
      postalCode: '69001',
      desiredJobTitle: 'Développeuse Front React',
      contractTypes: ['CDI', 'FREELANCE'],
      experienceLevel: 'CONFIRME',
      availability: 'IMMEDIATE',
      remotePolicy: 'HYBRID',
      mobilityRadiusKm: 30,
      mobilityNationwide: false,
      salaryMin: 45000,
      salaryMax: 60000,
      linkedinUrl: 'https://linkedin.com/in/ada',
    });
    // Derived from the reference entry that matched the pair, never from the
    // payload: `stubCityReference` mirrors the commune back at [4.835, 45.758].
    expect(Number(saved?.latitude)).toBeCloseTo(45.758, 3);
    expect(Number(saved?.longitude)).toBeCloseTo(4.835, 3);
  });

  it("updates the caller's own profile", async () => {
    const user = await createUser('candidate');
    await httpRequest(app)
      .post('/api/candidate-profiles')
      .set('Authorization', bearerFor(app, user.id, 'candidate'))
      .send({ firstName: 'Ada', lastName: 'Lovelace' })
      .expect(201);

    await httpRequest(app)
      .patch('/api/candidate-profiles/me')
      .set('Authorization', bearerFor(app, user.id, 'candidate'))
      .send({ bio: 'Nouvelle bio', salaryMin: 50000 })
      .expect(200);

    const saved = await prisma.candidateProfile.findUnique({
      where: { userId: user.id },
    });
    expect(saved).toMatchObject({ bio: 'Nouvelle bio', salaryMin: 50000 });
  });

  it('rejects an unauthenticated update with 401', async () => {
    await httpRequest(app)
      .patch('/api/candidate-profiles/me')
      .send({ bio: 'x' })
      .expect(401);
  });

  it('forbids a recruiter from updating a candidate profile (403)', async () => {
    const recruiter = await createUser('recruiter');

    await httpRequest(app)
      .patch('/api/candidate-profiles/me')
      .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
      .send({ bio: 'x' })
      .expect(403);
  });

  /**
   * The route is `me`: the target row is derived from the JWT subject, never
   * from the request, so another candidate's profile is not addressable at all.
   * What is worth locking is the consequence — a PATCH must leave every other
   * profile untouched.
   */
  it("leaves another candidate's profile untouched (ownership isolation)", async () => {
    const alice = await createUser('candidate');
    const bob = await createUser('candidate');

    for (const user of [alice, bob]) {
      await httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .send({ firstName: 'A', lastName: 'B', bio: 'origine' })
        .expect(201);
    }

    await httpRequest(app)
      .patch('/api/candidate-profiles/me')
      .set('Authorization', bearerFor(app, alice.id, 'candidate'))
      .send({ bio: 'modifiée' })
      .expect(200);

    const bobProfile = await prisma.candidateProfile.findUnique({
      where: { userId: bob.id },
    });
    expect(bobProfile?.bio).toBe('origine');
  });

  it('rejects a second create for the same user with 409', async () => {
    const user = await createUser('candidate');
    const create = () =>
      httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .send({ firstName: 'Ada', lastName: 'Lovelace' });

    await create().expect(201);
    await create().expect(409);
  });

  // The conflict is the caller's real problem; complaining about the commune
  // they sent would send them fixing the wrong thing.
  it('answers 409 on a duplicate profile before judging the location', async () => {
    const user = await createUser('candidate');

    await httpRequest(app)
      .post('/api/candidate-profiles')
      .set('Authorization', bearerFor(app, user.id, 'candidate'))
      .send({ firstName: 'Ada', lastName: 'Lovelace' })
      .expect(201);

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ features: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await httpRequest(app)
      .post('/api/candidate-profiles')
      .set('Authorization', bearerFor(app, user.id, 'candidate'))
      .send({
        firstName: 'Ada',
        lastName: 'Lovelace',
        city: 'Atlantide',
        postalCode: '00000',
      })
      .expect(409);
  });

  // « Anglais » is both a plausible skill and the canonical name of a language.
  // The tag dictionary is keyed on (label, category), so one does not decide
  // for the other — globally, for every user.
  it('keeps a language a language when the label already exists as a skill', async () => {
    const user = await createUser('candidate');

    await httpRequest(app)
      .post('/api/candidate-profiles')
      .set('Authorization', bearerFor(app, user.id, 'candidate'))
      .send({ firstName: 'Ada', lastName: 'Lovelace', skills: ['Anglais'] })
      .expect(201);

    await httpRequest(app)
      .patch('/api/candidate-profiles/me')
      .set('Authorization', bearerFor(app, user.id, 'candidate'))
      .send({ skills: [], languages: ['Anglais'] })
      .expect(200);

    const rows = await prisma.candidateTag.findMany({
      where: { candidateUserId: user.id },
      include: { tag: true },
    });

    expect(rows.map((row) => `${row.tag.label}:${row.tag.category}`)).toEqual([
      'Anglais:language',
    ]);
  });

  it('returns 404 when updating a profile that does not exist', async () => {
    const user = await createUser('candidate');

    await httpRequest(app)
      .patch('/api/candidate-profiles/me')
      .set('Authorization', bearerFor(app, user.id, 'candidate'))
      .send({ bio: 'x' })
      .expect(404);
  });

  it('rejects an invalid enum value with 400', async () => {
    const user = await createUser('candidate');

    await httpRequest(app)
      .post('/api/candidate-profiles')
      .set('Authorization', bearerFor(app, user.id, 'candidate'))
      .send({
        firstName: 'Ada',
        lastName: 'Lovelace',
        experienceLevel: 'NOT_A_LEVEL',
      })
      .expect(400);
  });

  it('rejects a city and postal code pair the reference does not know', async () => {
    const user = await createUser('candidate');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ features: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await httpRequest(app)
      .post('/api/candidate-profiles')
      .set('Authorization', bearerFor(app, user.id, 'candidate'))
      .send({
        firstName: 'Ada',
        lastName: 'Lovelace',
        city: 'Wakanda',
        postalCode: '99999',
      })
      .expect(400);

    const saved = await prisma.candidateProfile.findUnique({
      where: { userId: user.id },
    });
    expect(saved).toBeNull();
  });

  it('rejects a city sent without its postal code with 400', async () => {
    const user = await createUser('candidate');

    await httpRequest(app)
      .post('/api/candidate-profiles')
      .set('Authorization', bearerFor(app, user.id, 'candidate'))
      .send({ firstName: 'Ada', lastName: 'Lovelace', city: 'Marseille' })
      .expect(400);
  });

  /**
   * Fail-open: the check guards data quality, not access. An outage of the
   * reference must not make it impossible to finish an onboarding, and the
   * candidate has no way to act on the failure.
   */
  it('accepts the location when the reference is unreachable', async () => {
    const user = await createUser('candidate');
    fetchMock.mockRejectedValue(new Error('network down'));

    await httpRequest(app)
      .post('/api/candidate-profiles')
      .set('Authorization', bearerFor(app, user.id, 'candidate'))
      .send({
        firstName: 'Ada',
        lastName: 'Lovelace',
        city: 'Brest',
        postalCode: '29200',
      })
      .expect(201);
  });

  it('links skills as reusable tags (find-or-create)', async () => {
    const user = await createUser('candidate');

    await httpRequest(app)
      .post('/api/candidate-profiles')
      .set('Authorization', bearerFor(app, user.id, 'candidate'))
      .send({
        firstName: 'Ada',
        lastName: 'Lovelace',
        skills: ['React', 'TypeScript', 'Node.js'],
      })
      .expect(201);

    const links = await prisma.candidateTag.findMany({
      where: { candidateUserId: user.id },
      include: { tag: true },
    });
    expect(links.map((l) => l.tag.label).sort()).toEqual([
      'Node.js',
      'React',
      'TypeScript',
    ]);
    expect(links.every((l) => l.tag.category === 'skill')).toBe(true);
  });

  it('links languages as tags of their own category', async () => {
    const user = await createUser('candidate');

    await httpRequest(app)
      .post('/api/candidate-profiles')
      .set('Authorization', bearerFor(app, user.id, 'candidate'))
      .send({
        firstName: 'Ada',
        lastName: 'Lovelace',
        skills: ['React'],
        languages: ['Anglais', 'Espagnol'],
      })
      .expect(201);

    const links = await prisma.candidateTag.findMany({
      where: { candidateUserId: user.id },
      include: { tag: true },
    });

    expect(links.map((l) => l.tag.label).sort()).toEqual([
      'Anglais',
      'Espagnol',
      'React',
    ]);
    expect(
      links
        .filter((l) => l.tag.label !== 'React')
        .every((l) => l.tag.category === 'language'),
    ).toBe(true);
  });

  it('rejects a language label longer than the tag column with 400', async () => {
    const user = await createUser('candidate');

    await httpRequest(app)
      .post('/api/candidate-profiles')
      .set('Authorization', bearerFor(app, user.id, 'candidate'))
      .send({
        firstName: 'Ada',
        lastName: 'Lovelace',
        languages: ['x'.repeat(101)],
      })
      .expect(400);
  });

  it('reuses an existing tag shared by two candidates', async () => {
    const first = await createUser('candidate');
    const second = await createUser('candidate');

    for (const user of [first, second]) {
      await httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .send({ firstName: 'A', lastName: 'B', skills: ['React'] })
        .expect(201);
    }

    const reactTags = await prisma.tag.findMany({ where: { label: 'React' } });
    expect(reactTags).toHaveLength(1);
  });

  it('rejects unknown fields with 400', async () => {
    const user = await createUser('candidate');

    await httpRequest(app)
      .post('/api/candidate-profiles')
      .set('Authorization', bearerFor(app, user.id, 'candidate'))
      .send({ firstName: 'Ada', lastName: 'Lovelace', hacker: 'x' })
      .expect(400);
  });

  describe('GET /api/candidate-profiles/me', () => {
    const readMine = (userId: number) =>
      httpRequest(app)
        .get('/api/candidate-profiles/me')
        .set('Authorization', bearerFor(app, userId, 'candidate'));

    const linkTag = async (
      userId: number,
      label: string,
      category: 'skill' | 'language',
    ) => {
      const tag = await prisma.tag.create({ data: { label, category } });
      await prisma.candidateTag.create({
        data: { candidateUserId: userId, tagId: tag.id },
      });
    };

    it('rejects an unauthenticated read with 401', async () => {
      await httpRequest(app).get('/api/candidate-profiles/me').expect(401);
    });

    it('forbids a recruiter from reading a candidate profile (403)', async () => {
      const recruiter = await createUser('recruiter');

      await httpRequest(app)
        .get('/api/candidate-profiles/me')
        .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
        .expect(403);
    });

    it('refuses an inactive account with 403', async () => {
      const user = await createUser('candidate');
      await prisma.candidateProfile.create({
        data: { userId: user.id, firstName: 'Ada', lastName: 'Lovelace' },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
      });

      await readMine(user.id).expect(403);
    });

    // Same wording as the PATCH on the same row: one missing profile, one
    // message, whichever verb the client used.
    it('answers 404 when the caller has no profile', async () => {
      const user = await createUser('candidate');

      const res = await readMine(user.id).expect(404);

      expect((res.body as { message?: string }).message).toBe(
        'Candidate profile not found',
      );
    });

    it('returns the whole profile of the caller, and nothing else', async () => {
      const user = await createUser('candidate');
      await prisma.candidateProfile.create({
        data: {
          userId: user.id,
          firstName: 'Ada',
          lastName: 'Lovelace',
          picture: 'candidates/1/picture/ada.webp',
          bio: 'Pionnière du calcul.',
          city: 'Lyon',
          postalCode: '69001',
          latitude: '45.7578125',
          longitude: '4.8320114',
          desiredJobTitle: 'Développeuse Front React',
          contractTypes: ['CDI', 'FREELANCE'],
          experienceLevel: 'CONFIRME',
          availability: 'WITHIN_DELAY',
          availabilityDelayMonths: 3,
          availabilityDate: new Date('2026-09-01T00:00:00.000Z'),
          remotePolicy: 'HYBRID',
          mobilityRadiusKm: 30,
          mobilityNationwide: false,
          salaryMin: 45000,
          salaryMax: 60000,
          linkedinUrl: 'https://linkedin.com/in/ada',
          cvUrl: 'candidates/1/cv/ada.pdf',
        },
      });
      await linkTag(user.id, 'React', 'skill');
      await linkTag(user.id, 'Anglais', 'language');

      const res = await readMine(user.id).expect(200);

      // Exhaustive on purpose: `toEqual` fails on an extra key, so a column
      // added to `candidate_profile` later cannot reach a client unnoticed.
      expect(res.body).toEqual({
        id: expect.any(Number) as number,
        userId: user.id,
        firstName: 'Ada',
        lastName: 'Lovelace',
        picture: 'candidates/1/picture/ada.webp',
        bio: 'Pionnière du calcul.',
        city: 'Lyon',
        postalCode: '69001',
        latitude: expect.any(String) as string,
        longitude: expect.any(String) as string,
        desiredJobTitle: 'Développeuse Front React',
        contractTypes: ['CDI', 'FREELANCE'],
        experienceLevel: 'CONFIRME',
        availability: 'WITHIN_DELAY',
        availabilityDelayMonths: 3,
        availabilityDate: '2026-09-01T00:00:00.000Z',
        remotePolicy: 'HYBRID',
        mobilityRadiusKm: 30,
        mobilityNationwide: false,
        salaryMin: 45000,
        salaryMax: 60000,
        linkedinUrl: 'https://linkedin.com/in/ada',
        cvUrl: 'candidates/1/cv/ada.pdf',
        skills: ['React'],
        languages: ['Anglais'],
        createdAt: expect.any(String) as string,
        updatedAt: expect.any(String) as string,
      });

      // Decimal(10, 7) travels as a string, verbatim. The fixture carries all
      // seven decimals and the assertion compares the string, so a rounding
      // anywhere on the way out fails here — which a numeric tolerance would
      // have swallowed.
      const body = res.body as { latitude: string; longitude: string };
      expect(body.latitude).toBe('45.7578125');
      expect(body.longitude).toBe('4.8320114');
    });

    // The two lists come back separated and each sorted by label: the account
    // screen renders them as two distinct groups, and an unordered read would
    // reshuffle them on every request.
    it('splits skills and languages by category, each sorted by label', async () => {
      const user = await createUser('candidate');
      await prisma.candidateProfile.create({
        data: { userId: user.id, firstName: 'Ada', lastName: 'Lovelace' },
      });
      await linkTag(user.id, 'TypeScript', 'skill');
      await linkTag(user.id, 'Espagnol', 'language');
      await linkTag(user.id, 'React', 'skill');
      await linkTag(user.id, 'Anglais', 'language');

      const res = await readMine(user.id).expect(200);

      expect(res.body).toMatchObject({
        skills: ['React', 'TypeScript'],
        languages: ['Anglais', 'Espagnol'],
      });
    });

    it("never returns another candidate's profile", async () => {
      const alice = await createUser('candidate');
      const bob = await createUser('candidate');

      await prisma.candidateProfile.create({
        data: {
          userId: alice.id,
          firstName: 'Ada',
          lastName: 'Lovelace',
          bio: 'bio-alice',
        },
      });
      await prisma.candidateProfile.create({
        data: {
          userId: bob.id,
          firstName: 'Bob',
          lastName: 'Morane',
          bio: 'bio-bob',
        },
      });
      await linkTag(alice.id, 'React', 'skill');
      await linkTag(bob.id, 'COBOL', 'skill');

      const res = await readMine(alice.id).expect(200);

      expect(res.body).toMatchObject({
        userId: alice.id,
        bio: 'bio-alice',
        skills: ['React'],
      });
      expect(JSON.stringify(res.body)).not.toContain('bio-bob');
      expect(JSON.stringify(res.body)).not.toContain('COBOL');
    });

    /**
     * `toEqual` treats a missing key as `undefined` but not as `null`, so this
     * locks the keys being present and empty. The edit form binds to all of
     * them; an absent key would render as an uncontrolled input.
     */
    it('answers null and empty lists for a profile with nothing filled in', async () => {
      const user = await createUser('candidate');
      await prisma.candidateProfile.create({
        data: { userId: user.id, firstName: 'Ada', lastName: 'Lovelace' },
      });

      const res = await readMine(user.id).expect(200);

      expect(res.body).toEqual({
        id: expect.any(Number) as number,
        userId: user.id,
        firstName: 'Ada',
        lastName: 'Lovelace',
        picture: null,
        bio: null,
        city: null,
        postalCode: null,
        latitude: null,
        longitude: null,
        desiredJobTitle: null,
        contractTypes: [],
        experienceLevel: null,
        availability: null,
        availabilityDelayMonths: null,
        availabilityDate: null,
        remotePolicy: null,
        mobilityRadiusKm: null,
        mobilityNationwide: null,
        salaryMin: null,
        salaryMax: null,
        linkedinUrl: null,
        cvUrl: null,
        skills: [],
        languages: [],
        createdAt: expect.any(String) as string,
        updatedAt: expect.any(String) as string,
      });
    });
  });
});
