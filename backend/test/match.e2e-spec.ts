import { INestApplication } from '@nestjs/common';
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

  it('does not expose another company’s matches to a recruiter', async () => {
    const candidate = await createUser('candidate');
    const companyA = await seedRecruiterWithCompany('Acme');
    const companyB = await seedRecruiterWithCompany('Globex');
    const offerA = await prisma.offer.create({
      data: {
        title: 'Développeur Front',
        status: 'open',
        companyId: companyA.company.id,
        createdById: companyA.user.id,
      },
    });
    const offerB = await prisma.offer.create({
      data: {
        title: 'Développeur Back',
        status: 'open',
        companyId: companyB.company.id,
        createdById: companyB.user.id,
      },
    });
    const matchA = await prisma.match.create({
      data: {
        candidateUserId: candidate.id,
        offerId: offerA.id,
        recruiterUserId: companyA.user.id,
      },
    });
    await prisma.match.create({
      data: {
        candidateUserId: candidate.id,
        offerId: offerB.id,
        recruiterUserId: companyB.user.id,
      },
    });

    const res = await httpRequest(app)
      .get('/api/matches')
      .set('Authorization', bearerFor(app, companyA.user.id, 'recruiter'))
      .expect(200);

    expect(res.body).toHaveLength(1);
    const matches = res.body as Array<{ id: number }>;
    expect(matches[0]).toMatchObject({
      id: matchA.id,
      offer: { id: offerA.id, title: 'Développeur Front' },
    });
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
