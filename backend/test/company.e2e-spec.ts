import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Prisma } from '../generated/prisma/client';
import { httpRequest } from './http-client';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup-app';
import { bearerFor } from './auth-header';
import { stubCityReference } from './city-reference';
import { resetDb } from './reset-db';
import { resetCityCache } from './city-cache-reset';
import { resetThrottler } from './throttler-reset';

describe('Company (e2e)', () => {
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

  const asRecruiter = (id: number) =>
    httpRequest(app)
      .post('/api/companies')
      .set('Authorization', bearerFor(app, id, 'recruiter'));

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
      .post('/api/companies')
      .send({ name: 'Acme', firstName: 'R', lastName: 'D' })
      .expect(401);
  });

  it('forbids a candidate from creating a company (403)', async () => {
    const candidate = await createUser('candidate');
    await httpRequest(app)
      .post('/api/companies')
      .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
      .send({ name: 'Acme', firstName: 'R', lastName: 'D' })
      .expect(403);
  });

  /**
   * `CompanySize` was narrowed to the product's target (TPE, PME). These guard
   * the contract in both directions: the kept values still pass, and the values
   * dropped from the enum are refused rather than silently stored.
   */
  it.each(['TPE', 'PME'])('accepts %s as a company size', async (size) => {
    const recruiter = await createUser('recruiter');

    await asRecruiter(recruiter.id)
      .send({ name: 'Acme', size, firstName: 'Rick', lastName: 'Deckard' })
      .expect(201);
  });

  it.each(['ETI', 'GE', 'XL'])(
    'rejects %s, outside the product scope (400)',
    async (size) => {
      const recruiter = await createUser('recruiter');

      await asRecruiter(recruiter.id)
        .send({ name: 'Acme', size, firstName: 'Rick', lastName: 'Deckard' })
        .expect(400);
    },
  );

  it('creates the company, the linked recruiter profile and its benefits', async () => {
    const recruiter = await createUser('recruiter');

    await asRecruiter(recruiter.id)
      .send({
        name: 'Acme',
        size: 'PME',
        description: 'Une belle boîte.',
        siteUrl: 'https://acme.dev',
        city: 'Lyon',
        postalCode: '69002',
        firstName: 'Rick',
        lastName: 'Deckard',
        jobTitle: 'Responsable RH',
        benefits: ['Mutuelle', 'Télétravail'],
      })
      .expect(201);

    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId: recruiter.id },
      include: {
        company: { include: { companyTags: { include: { tag: true } } } },
      },
    });

    expect(profile).toMatchObject({
      firstName: 'Rick',
      lastName: 'Deckard',
      jobTitle: 'Responsable RH',
    });
    expect(profile?.company).toMatchObject({
      name: 'Acme',
      size: 'PME',
      city: 'Lyon',
    });
    expect(
      profile?.company.companyTags.map((ct) => ct.tag.label).sort(),
    ).toEqual(['Mutuelle', 'Télétravail']);
    expect(
      profile?.company.companyTags.every((ct) => ct.tag.category === 'benefit'),
    ).toBe(true);
  });

  it('rejects a second company for the same recruiter with 409', async () => {
    const recruiter = await createUser('recruiter');
    const payload = { name: 'Acme', firstName: 'R', lastName: 'D' };

    await asRecruiter(recruiter.id).send(payload).expect(201);
    await asRecruiter(recruiter.id).send(payload).expect(409);
  });

  it('rejects a city and postal code pair the reference does not know', async () => {
    const recruiter = await createUser('recruiter');
    (global.fetch as unknown as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ features: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await asRecruiter(recruiter.id)
      .send({
        name: 'Acme',
        firstName: 'R',
        lastName: 'D',
        city: 'Wakanda',
        postalCode: '99999',
      })
      .expect(400);

    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId: recruiter.id },
    });
    expect(profile).toBeNull();
  });

  it('rejects a company city sent without its postal code with 400', async () => {
    const recruiter = await createUser('recruiter');

    await asRecruiter(recruiter.id)
      .send({ name: 'Acme', firstName: 'R', lastName: 'D', city: 'Marseille' })
      .expect(400);
  });

  it('rejects an unauthenticated update with 401', async () => {
    await httpRequest(app)
      .patch('/api/companies/mine')
      .send({ name: 'Acme' })
      .expect(401);
  });

  it('forbids a candidate from updating a company (403)', async () => {
    const candidate = await createUser('candidate');

    await httpRequest(app)
      .patch('/api/companies/mine')
      .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
      .send({ name: 'Acme' })
      .expect(403);
  });

  it("updates only the caller's own company (ownership isolation)", async () => {
    const alice = await createUser('recruiter');
    const bob = await createUser('recruiter');

    await asRecruiter(alice.id)
      .send({ name: 'Alice Corp', firstName: 'A', lastName: 'A' })
      .expect(201);
    await asRecruiter(bob.id)
      .send({ name: 'Bob Corp', firstName: 'B', lastName: 'B' })
      .expect(201);

    await httpRequest(app)
      .patch('/api/companies/mine')
      .set('Authorization', bearerFor(app, alice.id, 'recruiter'))
      .send({ name: 'Alice Corp Renamed' })
      .expect(200);

    const aliceProfile = await prisma.recruiterProfile.findUnique({
      where: { userId: alice.id },
      include: { company: true },
    });
    const bobProfile = await prisma.recruiterProfile.findUnique({
      where: { userId: bob.id },
      include: { company: true },
    });

    expect(aliceProfile?.company.name).toBe('Alice Corp Renamed');
    expect(bobProfile?.company.name).toBe('Bob Corp');
  });

  it('returns 404 when updating a company for a recruiter without one', async () => {
    const recruiter = await createUser('recruiter');
    await httpRequest(app)
      .patch('/api/companies/mine')
      .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
      .send({ name: 'Nope' })
      .expect(404);
  });

  /**
   * The onboarding wizard replays its whole payload here when the create call
   * answers 409. Refusing the identity half would answer 400 on `firstName`
   * (`forbidNonWhitelisted`) and leave the recruiter unable to fix their own
   * name or job title — the create path is the only other writer.
   */
  it('accepts the full onboarding payload and updates both tables', async () => {
    const recruiter = await createUser('recruiter');
    const sector = await prisma.sector.create({ data: { label: 'Juridique' } });

    await asRecruiter(recruiter.id)
      .send({ name: 'Acme', firstName: 'Rick', lastName: 'Deckard' })
      .expect(201);

    await httpRequest(app)
      .patch('/api/companies/mine')
      .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
      .send({
        name: 'Acme Renamed',
        firstName: 'Rachael',
        lastName: 'Tyrell',
        jobTitle: 'CTO',
        sectorId: sector.id,
        size: 'TPE',
        benefits: ['Télétravail'],
      })
      .expect(200);

    const profile = await prisma.recruiterProfile.findUniqueOrThrow({
      where: { userId: recruiter.id },
      include: {
        company: { include: { companyTags: { include: { tag: true } } } },
      },
    });

    expect(profile.firstName).toBe('Rachael');
    expect(profile.lastName).toBe('Tyrell');
    expect(profile.jobTitle).toBe('CTO');
    expect(profile.company.name).toBe('Acme Renamed');
    expect(profile.company.sectorId).toBe(sector.id);
    expect(profile.company.size).toBe('TPE');
    expect(profile.company.companyTags.map((link) => link.tag.label)).toEqual([
      'Télétravail',
    ]);
  });

  // A partial update must not blank the identity: Prisma skips `undefined`, and
  // that is the only thing standing between a rename and a wiped profile.
  it('leaves the recruiter identity untouched when the patch omits it', async () => {
    const recruiter = await createUser('recruiter');

    await asRecruiter(recruiter.id)
      .send({
        name: 'Acme',
        firstName: 'Rick',
        lastName: 'Deckard',
        jobTitle: 'CTO',
      })
      .expect(201);

    await httpRequest(app)
      .patch('/api/companies/mine')
      .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
      .send({ name: 'Acme Renamed' })
      .expect(200);

    const profile = await prisma.recruiterProfile.findUniqueOrThrow({
      where: { userId: recruiter.id },
    });

    expect(profile.firstName).toBe('Rick');
    expect(profile.lastName).toBe('Deckard');
    expect(profile.jobTitle).toBe('CTO');
  });

  describe('GET /api/companies/mine', () => {
    const readMine = (userId: number) =>
      httpRequest(app)
        .get('/api/companies/mine')
        .set('Authorization', bearerFor(app, userId, 'recruiter'));

    const linkTag = async (
      companyId: number,
      label: string,
      category: 'benefit' | 'skill',
    ) => {
      const tag = await prisma.tag.create({ data: { label, category } });
      await prisma.companyTag.create({ data: { companyId, tagId: tag.id } });
    };

    const createRecruiterWithCompany = async (options?: {
      company?: Prisma.CompanyUncheckedCreateInput;
      firstName?: string;
      lastName?: string;
      jobTitle?: string | null;
    }) => {
      const user = await createUser('recruiter');
      const company = await prisma.company.create({
        data: options?.company ?? { name: 'Acme' },
      });
      await prisma.recruiterProfile.create({
        data: {
          userId: user.id,
          companyId: company.id,
          firstName: options?.firstName ?? 'Rick',
          lastName: options?.lastName ?? 'Deckard',
          jobTitle: options?.jobTitle ?? null,
        },
      });

      return { user, company };
    };

    it('rejects an unauthenticated read with 401', async () => {
      await httpRequest(app).get('/api/companies/mine').expect(401);
    });

    it('forbids a candidate from reading a company (403)', async () => {
      const candidate = await createUser('candidate');

      await httpRequest(app)
        .get('/api/companies/mine')
        .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
        .expect(403);
    });

    it('refuses an inactive recruiter with 403', async () => {
      const { user } = await createRecruiterWithCompany();
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
      });

      await readMine(user.id).expect(403);
    });

    // Same wording as the PATCH on the same resource: one missing company, one
    // message, whichever verb the client used.
    it('answers 404 for a recruiter without a company', async () => {
      const user = await createUser('recruiter');

      const res = await readMine(user.id).expect(404);

      expect((res.body as { message?: string }).message).toBe(
        'Recruiter has no company',
      );
    });

    it('returns the whole company plus the recruiter identity', async () => {
      const sector = await prisma.sector.create({
        data: { label: 'Informatique' },
      });
      const { user, company } = await createRecruiterWithCompany({
        company: {
          name: 'Acme',
          logo: 'companies/1/logo/acme.webp',
          size: 'PME',
          sectorId: sector.id,
          description: 'Une belle boîte.',
          siteUrl: 'https://acme.dev',
          coverImage: 'companies/1/cover-image/acme.webp',
          city: 'Lyon',
          postalCode: '69002',
          latitude: '45.7578125',
          longitude: '4.8320114',
        },
        jobTitle: 'CTO',
      });
      await linkTag(company.id, 'Mutuelle', 'benefit');

      const res = await readMine(user.id).expect(200);

      // Exhaustive on purpose: `toEqual` fails on an extra key, so a column
      // added to `company` later cannot reach a client unnoticed.
      expect(res.body).toEqual({
        id: company.id,
        name: 'Acme',
        logo: 'companies/1/logo/acme.webp',
        size: 'PME',
        sectorId: sector.id,
        description: 'Une belle boîte.',
        siteUrl: 'https://acme.dev',
        coverImage: 'companies/1/cover-image/acme.webp',
        city: 'Lyon',
        postalCode: '69002',
        latitude: expect.any(String) as string,
        longitude: expect.any(String) as string,
        benefits: ['Mutuelle'],
        recruiter: {
          firstName: 'Rick',
          lastName: 'Deckard',
          jobTitle: 'CTO',
        },
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

    /**
     * `company_tag` is only ever written with benefits today, but it is a plain
     * pivot on the shared `tag` dictionary: nothing in the schema stops another
     * category from being linked. The read filters on the category rather than
     * trusting the writer.
     */
    it('returns benefits only, sorted by label', async () => {
      const { user, company } = await createRecruiterWithCompany();
      await linkTag(company.id, 'Mutuelle', 'benefit');
      await linkTag(company.id, 'Conciergerie', 'benefit');
      await linkTag(company.id, 'React', 'skill');

      const res = await readMine(user.id).expect(200);

      expect(res.body).toMatchObject({
        benefits: ['Conciergerie', 'Mutuelle'],
      });
    });

    it("never returns another recruiter's company", async () => {
      const alice = await createRecruiterWithCompany({
        company: { name: 'Alice Corp', description: 'desc-alice' },
        firstName: 'Alice',
      });
      const bob = await createRecruiterWithCompany({
        company: { name: 'Bob Corp', description: 'desc-bob' },
        firstName: 'Bob',
      });
      await linkTag(alice.company.id, 'Mutuelle', 'benefit');
      await linkTag(bob.company.id, 'Voiture de fonction', 'benefit');

      const res = await readMine(alice.user.id).expect(200);

      expect(res.body).toMatchObject({
        id: alice.company.id,
        name: 'Alice Corp',
        benefits: ['Mutuelle'],
        recruiter: { firstName: 'Alice' },
      });
      expect(JSON.stringify(res.body)).not.toContain('Bob');
      expect(JSON.stringify(res.body)).not.toContain('desc-bob');
      expect(JSON.stringify(res.body)).not.toContain('Voiture de fonction');
    });

    /**
     * `toEqual` treats a missing key as `undefined` but not as `null`, so this
     * locks the keys being present and empty. The edit form binds to all of
     * them; an absent key would render as an uncontrolled input.
     */
    it('answers null and empty lists for a company with nothing filled in', async () => {
      const { user, company } = await createRecruiterWithCompany();

      const res = await readMine(user.id).expect(200);

      expect(res.body).toEqual({
        id: company.id,
        name: 'Acme',
        logo: null,
        size: null,
        sectorId: null,
        description: null,
        siteUrl: null,
        coverImage: null,
        city: null,
        postalCode: null,
        latitude: null,
        longitude: null,
        benefits: [],
        recruiter: {
          firstName: 'Rick',
          lastName: 'Deckard',
          jobTitle: null,
        },
        createdAt: expect.any(String) as string,
        updatedAt: expect.any(String) as string,
      });
    });
  });
});
