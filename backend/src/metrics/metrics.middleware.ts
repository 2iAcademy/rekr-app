import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { requestContext, writeFailure } from '../observability/failure-log';
import { performance } from 'node:perf_hooks';
import { MetricsService } from './metrics.service';

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
    const requestId = randomUUID();
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
