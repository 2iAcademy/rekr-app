import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { httpRequest } from './http-client';
import { AppModule } from './../src/app.module';
import { configureApp } from '../src/setup-app';
import { mountSwaggerIfExposed, shouldExposeSwagger } from '../src/swagger';
import { resetThrottler } from './throttler-reset';

/**
 * The one interaction the hardening middleware could silently break.
 *
 * `configureApp` serves `default-src 'none'` to every route, and Swagger UI is
 * an HTML page: under that policy it can load neither its bundle nor its
 * stylesheet, so it renders blank and nobody notices until someone opens the
 * docs — a 200 with an empty page is not a failing request. This
 * file boots the app exactly as `main.ts` does — `configureApp`, then
 * `mountSwaggerIfExposed` — and checks the page is both served and unpoliced.
 */
describe('Swagger (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    mountSwaggerIfExposed(app);
    await app.init();
  });

  beforeEach(() => {
    resetThrottler(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('is exposed outside production', () => {
    expect(process.env.NODE_ENV).not.toBe('production');
    expect(shouldExposeSwagger()).toBe(true);
  });

  it('hides itself in production', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(shouldExposeSwagger()).toBe(false);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it('serves the UI without a CSP that would blank it', async () => {
    const res = await httpRequest(app).get('/api/docs').expect(200);

    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers['content-security-policy']).toBeUndefined();
    expect(res.text).toContain('swagger-ui');
  });

  it('serves the OpenAPI document, still without a CSP', async () => {
    const res = await httpRequest(app).get('/api/docs-json').expect(200);

    expect(res.headers['content-security-policy']).toBeUndefined();
    expect((res.body as { openapi?: string }).openapi).toBeDefined();
  });

  /**
   * `/api/docs-yaml` is the only route that actually runs `js-yaml`, which
   * `package.json` pins to 5.2.2 through an override on `@nestjs/swagger`
   * (which itself pins 5.2.1 exact, and has no released fix). An override is a
   * dependency this project forces on someone else's tree; the least it owes
   * is a test that the forced version still serialises.
   */
  it('serves the OpenAPI document as YAML', async () => {
    const res = await httpRequest(app).get('/api/docs-yaml').expect(200);

    expect(res.text).toContain('openapi:');
    expect(res.text).toContain('paths:');
    expect(res.headers['content-security-policy']).toBeUndefined();
  });

  it('keeps the rest of the hardening on the documentation paths', async () => {
    const res = await httpRequest(app).get('/api/docs').expect(200);

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('still locks down the API routes next to it', async () => {
    const res = await httpRequest(app).get('/api').expect(200);

    expect(res.headers['content-security-policy']).toContain(
      "default-src 'none'",
    );
  });
});
