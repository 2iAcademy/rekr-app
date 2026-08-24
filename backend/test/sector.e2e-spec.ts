import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { httpRequest } from './http-client';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SectorDto } from '../src/sector/dto/sector.dto';
import { configureApp } from '../src/setup-app';
import { bearerFor } from './auth-header';
import { resetDb } from './reset-db';
import { resetThrottler } from './throttler-reset';

describe('Sector (e2e)', () => {
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

  const listSectorsAs = async (
    userId: number,
    userType: 'candidate' | 'recruiter',
  ): Promise<SectorDto[]> => {
    const res = await httpRequest(app)
      .get('/api/sectors')
      .set('Authorization', bearerFor(app, userId, userType))
      .expect(200);

    return res.body as SectorDto[];
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

  it('rejects an unauthenticated read with 401', async () => {
    await httpRequest(app).get('/api/sectors').expect(401);
  });

  it('lists sectors in label order', async () => {
    await prisma.sector.createMany({
      data: [
        { label: 'Informatique & Numérique' },
        { label: 'Bâtiment & Travaux publics' },
      ],
    });
    const recruiter = await createUser('recruiter');

    const sectors = await listSectorsAs(recruiter.id, 'recruiter');

    expect(sectors.map((sector) => sector.label)).toEqual([
      'Bâtiment & Travaux publics',
      'Informatique & Numérique',
    ]);
    // The service selects explicitly, so no other column can leak into the
    // reference payload.
    expect(Object.keys(sectors[0])).toEqual(['id', 'label']);
    expect(typeof sectors[0].id).toBe('number');
  });

  // Reference data both user types read: a candidate will filter offers on it.
  it('allows a candidate to read the reference data', async () => {
    await prisma.sector.create({ data: { label: 'Juridique' } });
    const candidate = await createUser('candidate');

    const sectors = await listSectorsAs(candidate.id, 'candidate');

    expect(sectors).toHaveLength(1);
  });

  it('answers with an empty list rather than failing when nothing is seeded', async () => {
    const recruiter = await createUser('recruiter');

    await expect(listSectorsAs(recruiter.id, 'recruiter')).resolves.toEqual([]);
  });

  it('stores the sector chosen at company creation', async () => {
    const sector = await prisma.sector.create({
      data: { label: 'Informatique & Numérique' },
    });
    const recruiter = await createUser('recruiter');

    await httpRequest(app)
      .post('/api/companies')
      .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
      .send({
        name: 'Rekr',
        firstName: 'Julien',
        lastName: 'Lemaitre',
        sectorId: sector.id,
      })
      .expect(201);

    const stored = await prisma.company.findFirstOrThrow({
      select: { sectorId: true },
    });
    expect(stored.sectorId).toBe(sector.id);
  });

  it('refuses a sector that does not exist', async () => {
    const recruiter = await createUser('recruiter');

    await httpRequest(app)
      .post('/api/companies')
      .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
      .send({
        name: 'Rekr',
        firstName: 'Julien',
        lastName: 'Lemaitre',
        sectorId: 999999,
      })
      .expect(400);
  });
});
