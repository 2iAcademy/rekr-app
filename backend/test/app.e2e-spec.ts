import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { httpRequest } from './http-client';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from '../src/setup-app';
import { resetThrottler } from './throttler-reset';

/**
 * `configureApp` is what `main.ts` runs before listening: global prefix,
 * hardening headers, ValidationPipe. Booting without it made this file certify
 * a shape production does not serve — `/` instead of `/api`, and no validation
 * at all. Every other e2e file already calls it; this one now does too.
 */
describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    resetThrottler(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api (GET)', () => {
    return httpRequest(app).get('/api').expect(200).expect('Hello World!');
  });

  it('serves nothing outside the global prefix', () => {
    return httpRequest(app).get('/').expect(404);
  });
});
