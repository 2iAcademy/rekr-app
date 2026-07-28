const STATUSES_WITHOUT_BODY = [204, 205, 304];

interface ApiErrorInit {
  status: number;
  statusText: string;
  url: string;
  data: unknown;
}

/**
 * Error thrown for any non-2xx HTTP response. `data` carries the parsed
 * response body so callers can surface backend validation messages; the
 * `message` deliberately carries neither the request body nor the query
 * string, because it ends up in console output and Sentry breadcrumbs.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly url: string;
  readonly data: unknown;

  constructor({ status, statusText, url, data }: ApiErrorInit) {
    super(
      `Request failed with status ${status}${statusText ? ` ${statusText}` : ''} on ${stripQuery(url)}`,
    );
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.url = url;
    this.data = data;
  }
}

const stripQuery = (url: string): string => url.split('?')[0].split('#')[0];

const parseBody = (body: string | null, contentType: string): unknown => {
  if (!body) {
    return undefined;
  }

  if (!contentType.toLowerCase().includes('json')) {
    return body;
  }

  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
};

/**
 * Orval mutator for the `fetch` client (see orval.config.ts).
 *
 * Orval's default fetch implementation resolves whatever the server returned,
 * so a 401 or a 400 looked exactly like a success to the caller. This wrapper
 * rejects with an `ApiError` on any non-2xx response.
 */
export const customFetch = async <T>(url: string, options: RequestInit): Promise<T> => {
  const res = await fetch(url, options);

  const rawBody = STATUSES_WITHOUT_BODY.includes(res.status) ? null : await res.text();
  const data = parseBody(rawBody, res.headers.get('content-type') ?? '');

  if (!res.ok) {
    throw new ApiError({
      status: res.status,
      statusText: res.statusText,
      url,
      data,
    });
  }

  return { data, status: res.status, headers: res.headers } as T;
};
