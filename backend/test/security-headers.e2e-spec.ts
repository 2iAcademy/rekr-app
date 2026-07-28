import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { httpRequest } from './http-client';
import { AppModule } from './../src/app.module';
import { configureApp } from '../src/setup-app';
import { resetThrottler } from './throttler-reset';

/**
 * The HTTP hardening headers, and the one exception that keeps Swagger usable.
 *
 * Every route of this API answers JSON, so the Content-Security-Policy that
 * matters here is the lockdown one: a JSON body has nothing to load and nothing
 * to execute. The single HTML surface is Swagger UI, mounted straight on the
 * Express instance in `main.ts` and gated behind `NODE_ENV !== 'production'`;
 * under `default-src 'none'` it could load neither its own bundle nor its
 * stylesheet and would render blank. Those paths are therefore the only ones
 * exempted from CSP — and only CSP: they keep `nosniff` and the rest.
 * `swagger.e2e-spec.ts` checks the page actually works.
 */
describe('Security headers (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    resetThrottler(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('locks down a JSON response with a default-src none policy', async () => {
    const res = await httpRequest(app).get('/api').expect(200);

    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('sets the transport and sniffing guards on a JSON response', async () => {
    const res = await httpRequest(app).get('/api').expect(200);

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(res.headers['strict-transport-security']).toContain('max-age=');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('does not advertise policies that a JSON response cannot honour', async () => {
    const res = await httpRequest(app).get('/api').expect(200);

    expect(res.headers['cross-origin-opener-policy']).toBeUndefined();
    expect(res.headers['cross-origin-embedder-policy']).toBeUndefined();
  });

  /**
   * Swagger is not mounted by `configureApp` — `main.ts` adds it afterwards — so
   * these paths 404 here. What is asserted is the middleware decision, which is
   * taken before routing: no CSP on the documentation prefix, hardening
   * everywhere else on the same response.
   */
  it.each(['/api/docs', '/api/docs-json', '/api/docs/swagger-ui.css'])(
    'exempts %s from CSP so Swagger UI can boot',
    async (path) => {
      const res = await httpRequest(app).get(path);

      expect(res.headers['content-security-policy']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    },
  );

  it('does not let a lookalike path smuggle itself out of the policy', async () => {
    const res = await httpRequest(app).get('/api/docsomething');

    expect(res.headers['content-security-policy']).toContain(
      "default-src 'none'",
    );
  });

  /**
   * The exemption exists for one reason: Swagger UI is HTML and cannot boot
   * under `default-src 'none'`. In production Swagger is not mounted at all
   * (`shouldExposeSwagger`), so those paths serve a plain 404 — and were still
   * being served without a policy, an unpoliced hole kept open for a page that
   * is not there. The exemption has to be conditional on the page existing.
   */
  it('drops the exemption when Swagger is not exposed', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await httpRequest(app).get('/api/docs');

      expect(res.headers['content-security-policy']).toContain(
        "default-src 'none'",
      );
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
