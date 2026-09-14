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
   * A match is born of a reciprocal like on one given offer, so a recruiter
   * reads it on the offer concerned — not in a list spanning every post of the
   * company. The route is a candidate route now.
   *
   * 403 rather than an empty list: an empty 200 would read as « you have no
   * match » and invite a caller to keep asking.
   */
  it('refuses the match list to a recruiter (403)', async () => {
    const recruiter = await seedRecruiterWithCompany('Acme');

    await httpRequest(app)
      .get('/api/matches')
      .set('Authorization', bearerFor(app, recruiter.user.id, 'recruiter'))
      .expect(403);
  });

  it('rejects an unauthenticated read with 401', async () => {
    await httpRequest(app).get('/api/matches').expect(401);
  });

  /**
   * The list has one shape now, and the document has to say so. While the
   * recruiter branch existed, a counterpart could be a candidate and could be
   * missing — a match whose candidate had no profile answered `null`. Both are
   * gone: every row of a candidate's list carries the company of the offer.
   *
   * Guarded here because the contract is what the client is generated from: a
   * `counterpart` still advertised as nullable makes every reader write a
   * fallback for a case the API can no longer produce.
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
});
