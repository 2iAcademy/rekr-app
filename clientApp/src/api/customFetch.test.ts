import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApiError, customFetch } from './customFetch';

interface FetchResult {
  data: unknown;
  status: number;
  headers: Headers;
}

const respond = (
  body: string | null,
  init: { status: number; statusText?: string; contentType?: string | null },
) => {
  const headers = new Headers();
  if (init.contentType !== null) {
    headers.set('content-type', init.contentType ?? 'application/json');
  }

  const response = {
    ok: init.status >= 200 && init.status < 300,
    status: init.status,
    statusText: init.statusText ?? '',
    headers,
    text: vi.fn().mockResolvedValue(body ?? ''),
  };

  return response as unknown as Response;
};

const mockFetch = (response: Response) => {
  const fetchSpy = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
};

/** Resolves with the rejection reason of `promise`, typed as an ApiError. */
const captureError = async (promise: Promise<unknown>): Promise<ApiError> => {
  try {
    await promise;
    throw new Error('Expected the request to reject, but it resolved');
  } catch (error) {
    return error as ApiError;
  }
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('customFetch', () => {
  describe('successful responses', () => {
    it('returns data, status and headers on 200', async () => {
      mockFetch(respond('{"id":"u-1"}', { status: 200 }));

      const result = await customFetch<FetchResult>('/api/me', { method: 'GET' });

      expect(result.data).toEqual({ id: 'u-1' });
      expect(result.status).toBe(200);
      expect(result.headers.get('content-type')).toBe('application/json');
    });

    it('forwards url and request init untouched to fetch', async () => {
      const fetchSpy = mockFetch(respond(null, { status: 201 }));
      const init: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@rekr.fr' }),
      };

      await customFetch<FetchResult>('/api/auth/signup', init);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith('/api/auth/signup', init);
    });

    it('does not read a body for 204/205/304 responses', async () => {
      const response = respond(null, { status: 204 });
      mockFetch(response);

      const result = await customFetch<FetchResult>('/api/logs/sample', { method: 'POST' });

      expect(result.data).toBeUndefined();
      expect(response.text).not.toHaveBeenCalled();
    });

    it('keeps a non-JSON success body as raw text instead of crashing on JSON.parse', async () => {
      mockFetch(respond('Hello World!', { status: 200, contentType: 'text/html; charset=utf-8' }));

      const result = await customFetch<FetchResult>('/api', { method: 'GET' });

      expect(result.data).toBe('Hello World!');
    });
  });

  describe('error responses', () => {
    it('throws an ApiError on 401 instead of resolving silently', async () => {
      mockFetch(respond('{"message":"Unauthorized"}', { status: 401, statusText: 'Unauthorized' }));

      const promise = customFetch<FetchResult>('/api/auth/login', { method: 'POST' });

      await expect(promise).rejects.toBeInstanceOf(ApiError);
      await expect(promise).rejects.toMatchObject({
        status: 401,
        data: { message: 'Unauthorized' },
      });
    });

    it('throws an ApiError on 400 and exposes the validation payload', async () => {
      mockFetch(
        respond('{"message":["password is too short"],"error":"Bad Request"}', {
          status: 400,
          statusText: 'Bad Request',
        }),
      );

      const promise = customFetch<FetchResult>('/api/auth/signup', { method: 'POST' });

      await expect(promise).rejects.toBeInstanceOf(ApiError);
      await expect(promise).rejects.toMatchObject({
        status: 400,
        data: { message: ['password is too short'], error: 'Bad Request' },
      });
    });

    it('throws an ApiError on 409', async () => {
      mockFetch(respond('{"message":"Email already used"}', { status: 409 }));

      await expect(
        customFetch<FetchResult>('/api/auth/signup', { method: 'POST' }),
      ).rejects.toBeInstanceOf(ApiError);
    });

    it('throws on a 500 whose body is not JSON, without a parsing crash', async () => {
      mockFetch(
        respond('<html>Bad Gateway</html>', {
          status: 502,
          statusText: 'Bad Gateway',
          contentType: 'text/html',
        }),
      );

      const promise = customFetch<FetchResult>('/api/auth/login', { method: 'POST' });

      await expect(promise).rejects.toBeInstanceOf(ApiError);
      await expect(promise).rejects.toMatchObject({
        status: 502,
        data: '<html>Bad Gateway</html>',
      });
    });

    it('exposes status and url on the error', async () => {
      mockFetch(respond('{}', { status: 403, statusText: 'Forbidden' }));

      const error = await captureError(customFetch('/api/offers/1', { method: 'GET' }));

      expect(error).toBeInstanceOf(ApiError);
      expect(error.name).toBe('ApiError');
      expect(error.status).toBe(403);
      expect(error.url).toBe('/api/offers/1');
      expect(error.message).toContain('403');
    });
  });

  describe('privacy of the error message', () => {
    it('never leaks the request body into the error message', async () => {
      mockFetch(respond('{"message":"Unauthorized"}', { status: 401 }));

      const error = await captureError(
        customFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: 'user@rekr.fr', password: 'sup3rs3cret' }),
        }),
      );

      expect(error.message).not.toContain('sup3rs3cret');
      expect(error.message).not.toContain('user@rekr.fr');
    });

    it('strips the query string from the error message', async () => {
      mockFetch(respond('{}', { status: 401 }));

      const error = await captureError(
        customFetch('/api/auth/callback?token=abc123&email=user@rekr.fr', { method: 'GET' }),
      );

      expect(error.message).not.toContain('abc123');
      expect(error.message).toContain('/api/auth/callback');
    });
  });
});
