import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';

/**
 * `INestApplication.getHttpServer()` is declared as returning `any`, while
 * supertest's `request()` expects an `App`. Every direct
 * `request(app.getHttpServer())` therefore trips
 * `@typescript-eslint/no-unsafe-argument` — 118 times across the e2e suite.
 *
 * Narrowing it once here keeps that single unavoidable cast in one reviewable
 * place, instead of scattering `eslint-disable` comments over every call site
 * (which would also silence genuine unsafe arguments introduced later).
 *
 * The app is expected to be listening already, on `127.0.0.1`: every spec
 * starts it with `app.listen(0, '127.0.0.1')` rather than `app.init()`. Left
 * to supertest, the server is bound on `::` for each request and dialled on
 * `127.0.0.1`; macOS accepts that bind while another process holds the same
 * loopback port, and the request lands on that process — a stranger's 404, or
 * an ECONNRESET, one full run in two (gh#191). Bound on the address it is
 * dialled on, a taken port is refused instead. Refusing an unbound app here
 * keeps the next spec from quietly going back to the old way.
 */
export const httpRequest = (app: INestApplication) => {
  const server = app.getHttpServer() as Server;
  if (!server.listening) {
    throw new Error(
      "Start the app with `await app.listen(0, '127.0.0.1')` before calling httpRequest.",
    );
  }
  return request(server);
};
