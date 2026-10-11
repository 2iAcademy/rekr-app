import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { MetricsMiddleware } from './metrics.middleware';
import { MetricsService } from './metrics.service';
import { requestContext } from '../observability/failure-log';

describe('HTTP failure logging', () => {
  const output = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  afterEach(() => output.mockClear());
  afterAll(() => output.mockRestore());

  function respond(statusCode: number, url = '/api/offers/123?token=secret') {
    const recordHttpRequest = jest.fn();
    const middleware = new MetricsMiddleware({
      recordHttpRequest,
    } as unknown as MetricsService);
    const req = { originalUrl: url, method: 'GET' } as Request;
    const res = Object.assign(new EventEmitter(), {
      statusCode,
      setHeader: jest.fn(),
    });
    let contextId: string | undefined;
    middleware.use(req, res as unknown as Response, () => {
      contextId = requestContext.getStore()?.request_id;
      req.route = { path: '/api/offers/:id' };
    });
    res.emit('finish');
    res.emit('finish');
    return { res, contextId, recordHttpRequest };
  }

  it('logs a completed 503 once with a route template and the generated request ID', () => {
    const { res, contextId, recordHttpRequest } = respond(503);
    expect(output).toHaveBeenCalledTimes(1);
    const line = String(output.mock.calls[0][0]);
    expect(JSON.parse(line)).toMatchObject({
      event: 'http_request_failed',
      status_code: 503,
      route: '/api/offers/:id',
      request_id: contextId,
    });
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', contextId);
    expect(line).not.toContain('/offers/123');
    expect(line).not.toContain('secret');
    expect(recordHttpRequest).toHaveBeenCalledTimes(1);
  });

  it.each([200, 400, 401, 404])(
    'does not log status %s as a server failure',
    (status) => {
      respond(status);
      expect(output).not.toHaveBeenCalled();
    },
  );

  it('continues to exclude metrics scrapes', () => {
    const { recordHttpRequest } = respond(503, '/api/metrics');
    expect(output).not.toHaveBeenCalled();
    expect(recordHttpRequest).not.toHaveBeenCalled();
  });
});
