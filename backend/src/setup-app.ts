import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { shouldExposeSwagger } from './swagger';

type ExpressLikeInstance = { set: (key: string, value: unknown) => void };

/**
 * Swagger UI, mounted straight on the Express instance by `main.ts` and gated
 * behind `NODE_ENV !== 'production'`. It is the only HTML this server returns,
 * and `default-src 'none'` below forbids loading any script or stylesheet at
 * all — including its own same-origin `swagger-ui-bundle.js` and the inline
 * block that configures it. The page would render blank. These paths are
 * therefore the one place where CSP is skipped; every other header stays.
 *
 * `/api/docs-json` and `/api/docs-yaml` are siblings of `/api/docs`, not
 * children, hence the explicit list next to the subtree test. A `startsWith`
 * on the bare prefix would also exempt `/api/docsomething`.
 */
const SWAGGER_PATHS = ['/api/docs', '/api/docs-json', '/api/docs-yaml'];
const SWAGGER_SUBTREE = '/api/docs/';

function isSwaggerPath(url: string): boolean {
  const path = url.split('?')[0];
  return SWAGGER_PATHS.includes(path) || path.startsWith(SWAGGER_SUBTREE);
}

/**
 * Content-Security-Policy for a JSON API.
 *
 * Helmet's default policy is written for a server that renders HTML: it allows
 * `'self'` scripts, styles and images because a page needs them. No route here
 * returns a document, so every one of those allowances is a directive without
 * an object. `default-src 'none'` is both stricter and more honest — a JSON
 * response has nothing to fetch and nothing to execute — and it is the policy
 * that matters when a browser is pointed straight at an API URL that echoes
 * user-supplied content back.
 *
 * `base-uri`, `form-action` and `frame-ancestors` are spelled out because
 * `default-src` does not cover them.
 */
const API_CONTENT_SECURITY_POLICY = helmet.contentSecurityPolicy({
  useDefaults: false,
  directives: {
    'default-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'none'"],
    'frame-ancestors': ["'none'"],
  },
});

function contentSecurityPolicyExceptOnSwagger() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Gated on Swagger actually being mounted, not on the path alone. In
    // production `mountSwaggerIfExposed` mounts nothing, so these paths return
    // a plain 404 — exempting them there would leave an unpoliced hole open
    // for a page that does not exist.
    if (shouldExposeSwagger() && isSwaggerPath(req.url)) {
      next();
      return;
    }

    API_CONTENT_SECURITY_POLICY(req, res, next);
  };
}

/**
 * Everything helmet sets by default, minus what a JSON API cannot honour.
 *
 * Kept: `X-Content-Type-Options: nosniff` (the one that stops a browser from
 * re-typing a JSON body as HTML), HSTS, `Referrer-Policy: no-referrer`,
 * `Cross-Origin-Resource-Policy: same-origin` — which blocks no-cors embedding
 * of API responses without touching CORS fetches — `Origin-Agent-Cluster`, and
 * the removal of `X-Powered-By`.
 *
 * Changed or dropped:
 *  - `contentSecurityPolicy: false` here, re-added above with a path-aware
 *    wrapper. Helmet takes no per-path option.
 *  - `xFrameOptions: deny` instead of helmet's `SAMEORIGIN`: nothing in this
 *    API is meant to be framed, not even by itself.
 *  - `crossOriginOpenerPolicy: false`: COOP isolates a browsing context, and a
 *    JSON response never opens one. Left on it would only be noise on the
 *    single HTML page, Swagger, which opens nothing either.
 *  - `crossOriginEmbedderPolicy` stays off, which is helmet's own default:
 *    `require-corp` demands a CORP header on every subresource, and would break
 *    Swagger UI's assets for no gain on a JSON API.
 */
const HELMET_OPTIONS = {
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: false,
  xFrameOptions: { action: 'deny' },
} as const;

// An Express application is a callable object: `typeof app === 'function'`.
// Testing only for 'object' here silently skips the trust-proxy setting.
function isExpressLikeInstance(value: unknown): value is ExpressLikeInstance {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as ExpressLikeInstance).set === 'function'
  );
}

/**
 * Number of reverse proxies in front of the API, read from `TRUST_PROXY_HOPS`.
 *
 * This is what decides whose address the rate limiter counts. `ThrottlerGuard`
 * keys its buckets on `req.ip`:
 *
 *  - hops = 0 (default): `req.ip` is the socket address. Correct when the API
 *    is reached directly. Behind a proxy every client collapses into the
 *    proxy's single address, and five bad logins freeze authentication for
 *    everyone — the limiter becomes the outage.
 *  - hops = n > 0: Express walks n entries back from the right of
 *    `X-Forwarded-For`. Only the hops the infrastructure actually appends are
 *    trusted, so a forged header cannot move the counter.
 *
 * `trust proxy: true` is deliberately not reachable through this knob: it makes
 * the leftmost, client-supplied `X-Forwarded-For` entry authoritative, and a
 * fresh value per request resets the bucket every time. That "fix" would
 * silently delete the whole rate limit.
 */
function readTrustProxyHops(): number {
  const raw = process.env.TRUST_PROXY_HOPS;
  if (raw === undefined || raw.trim() === '') {
    return 0;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(
      `TRUST_PROXY_HOPS must be a non-negative integer, received "${raw}".`,
    );
  }

  return parsed;
}

export function configureApp(app: INestApplication): void {
  app.use(cookieParser());

  app.setGlobalPrefix('api');

  const hops = readTrustProxyHops();
  if (hops > 0) {
    const httpInstance: unknown = app.getHttpAdapter().getInstance();
    if (isExpressLikeInstance(httpInstance)) {
      httpInstance.set('trust proxy', hops);
    }
  }

  app.use(helmet(HELMET_OPTIONS));
  app.use(contentSecurityPolicyExceptOnSwagger());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
