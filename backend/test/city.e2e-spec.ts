import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { httpRequest } from './http-client';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup-app';
import { bearerFor } from './auth-header';
import { resetDb } from './reset-db';
import { resetCityCache } from './city-cache-reset';
import { resetThrottler } from './throttler-reset';

const banAnswers = (
  features: { city: string; postcode: string; coordinates: [number, number] }[],
): Response =>
  new Response(
    JSON.stringify({
      features: features.map(({ city, postcode, coordinates }) => ({
        properties: { city, postcode },
        geometry: { coordinates },
      })),
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

describe('City (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let candidateId: number;
  let fetchMock: jest.Mock;

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

    const user = await prisma.user.create({
      data: {
        email: `candidate-${String(Date.now())}-${String(Math.random())}@test.dev`,
        passwordHash: 'x',
        userType: 'candidate',
      },
    });
    candidateId = user.id;

    // The reference is a third party; the suite must not depend on it being up.
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterAll(async () => {
    await app.close();
  });

  const asCandidate = (query: string) =>
    httpRequest(app)
      .get(`/api/cities?q=${encodeURIComponent(query)}`)
      .set('Authorization', bearerFor(app, candidateId, 'candidate'));

  it('rejects an unauthenticated search with 401', async () => {
    await httpRequest(app).get('/api/cities?q=lyon').expect(401);
  });

  it('returns the municipalities the reference knows', async () => {
    fetchMock.mockResolvedValue(
      banAnswers([
        {
          city: 'Bordeaux',
          postcode: '33000',
          coordinates: [-0.57918, 44.837789],
        },
      ]),
    );

    const response = await asCandidate('bordeaux').expect(200);

    expect(response.body).toEqual([
      {
        name: 'Bordeaux',
        postalCode: '33000',
        latitude: 44.837789,
        longitude: -0.57918,
      },
    ]);
  });

  it('rejects a query shorter than the reference accepts with 400', async () => {
    await asCandidate('ly').expect(400);
  });

  it('rejects a search without a query with 400', async () => {
    await httpRequest(app)
      .get('/api/cities')
      .set('Authorization', bearerFor(app, candidateId, 'candidate'))
      .expect(400);
  });

  it('rejects an unknown query parameter with 400', async () => {
    await httpRequest(app)
      .get('/api/cities?q=nantes&limit=999')
      .set('Authorization', bearerFor(app, candidateId, 'candidate'))
      .expect(400);
  });

  // An outage of the reference answers "nothing found", never a 500 the client
  // would have to interpret.
  it('answers with an empty list when the reference is down', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    const response = await asCandidate('brest').expect(200);

    expect(response.body).toEqual([]);
  });
});
