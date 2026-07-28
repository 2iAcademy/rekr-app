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
 */
export const httpRequest = (app: INestApplication) =>
  request(app.getHttpServer() as Server);
