import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OfferSearchService } from '../src/search/offer-search.service';
import { configureApp } from '../src/setup-app';
import { httpRequest } from './http-client';
import { resetThrottler } from './throttler-reset';

describe('Health routes (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
  });

  beforeEach(() => {
    resetThrottler(app);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports the API up without authentication when PostgreSQL answers', async () => {
    const response = await httpRequest(app).get('/api/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      info: { database: { status: 'up' } },
    });
  });

  it('answers 503 without leaking the driver error when PostgreSQL is down', async () => {
    jest
      .spyOn(app.get(PrismaService), '$queryRaw')
      .mockRejectedValue(
        new Error('Can\'t reach database server at "db.internal:5432"'),
      );

    const response = await httpRequest(app).get('/api/health').expect(503);

    expect(response.body).toMatchObject({
      status: 'error',
      error: { database: { status: 'down' } },
    });
    expect(JSON.stringify(response.body)).not.toContain('db.internal');
  });

  it('reports search up when the offers index is reachable', async () => {
    jest
      .spyOn(app.get(OfferSearchService), 'availability')
      .mockResolvedValue('available');

    const response = await httpRequest(app)
      .get('/api/health/search')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      info: { search: { status: 'up' } },
    });
  });

  it('reports search disabled as up, so a switched-off cluster raises no alert', async () => {
    jest
      .spyOn(app.get(OfferSearchService), 'availability')
      .mockResolvedValue('disabled');

    const response = await httpRequest(app)
      .get('/api/health/search')
      .expect(200);

    expect(response.body).toMatchObject({
      info: { search: { status: 'up', mode: 'disabled' } },
    });
  });

  it('answers 503 on search, and keeps /api/health up, when Elasticsearch is down', async () => {
    jest
      .spyOn(app.get(OfferSearchService), 'availability')
      .mockResolvedValue('unavailable');

    await httpRequest(app).get('/api/health/search').expect(503);
    await httpRequest(app).get('/api/health').expect(200);
  });
});
