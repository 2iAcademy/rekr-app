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
});
