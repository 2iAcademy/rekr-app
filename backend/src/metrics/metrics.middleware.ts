import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { requestContext, writeFailure } from '../observability/failure-log';
import { performance } from 'node:perf_hooks';
import { MetricsService } from './metrics.service';

/**
 * An upstream ID is reused only if it is short and made of safe characters: it
 * ends up in every log line of the request, so a client must not be able to
 * inject a newline, a JSON fragment or a megabyte of text there.
 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function resolveRequestId(incoming: unknown): string {
  return typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming)
    ? incoming
    : randomUUID();
}

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const path = req.originalUrl.split('?')[0];

    // Exclude Prometheus scrapes from application traffic measurements.
    if (/^\/api\/metrics\/?$/i.test(path)) {
      next();
      return;
    }

    const startedAt = performance.now();
    const requestId = resolveRequestId(req.headers['x-request-id']);
    res.setHeader('X-Request-ID', requestId);

    res.once('finish', () => {
      const durationSeconds = (performance.now() - startedAt) / 1000;

      // Read the route after Express has matched the request.
      const matchedRoute = req.route as { path?: unknown } | undefined;
      const route =
        typeof matchedRoute?.path === 'string'
          ? matchedRoute.path
          : 'unmatched';

      if (res.statusCode >= 500) {
        writeFailure('http_request_failed', {
          request_id: requestId,
          method: req.method,
          route,
          status_code: res.statusCode,
          duration_ms: Math.round(durationSeconds * 1000),
        });
      }

      this.metricsService.recordHttpRequest(
        req.method,
        route,
        res.statusCode,
        durationSeconds,
      );
    });

    requestContext.run({ request_id: requestId }, next);
  }
}
