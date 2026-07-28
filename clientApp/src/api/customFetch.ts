import {
  clearAccessToken,
  getAccessToken,
  notifySessionExpired,
  setAccessToken,
} from './tokenStore';

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

const REFRESH_URL = '/api/auth/refresh';

/**
 * A 401 on these is an answer, not an expired session: a wrong password, or a
 * refresh token that is genuinely dead. Retrying them would loop, or bury the
 * real error under a second failure.
 */
const NO_RETRY_ROUTES = ['/auth/login', '/auth/signup', '/auth/refresh', '/auth/logout'];

const isRetryable = (url: string): boolean => !NO_RETRY_ROUTES.some((route) => url.includes(route));

const withAuthorization = (options: RequestInit): RequestInit => {
  const token = getAccessToken();
  if (!token) {
    return options;
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);

  return { ...options, headers };
};

let inFlightRefresh: Promise<boolean> | null = null;

/** Goes through a bare `fetch` rather than `customFetch`: routing it through
 * the wrapper that calls it would recurse on the first failure. */
const requestRefresh = async (): Promise<boolean> => {
  const res = await fetch(REFRESH_URL, {
    method: 'POST',
    credentials: 'same-origin',
  });

  if (!res.ok) {
    clearAccessToken();
    notifySessionExpired();

    return false;
  }

  // `res.text()` + `parseBody`, not `res.json()`: it keeps this call consistent
  // with the rest of the module's response handling (and with how the tests
  // stub `Response` — `text()` only, no `json()`).
  const body = parseBody(await res.text(), res.headers.get('content-type') ?? '') as {
    accessToken: string;
  };
  setAccessToken(body.accessToken);

  return true;
};

/**
 * One refresh in flight at a time. No longer load-bearing for correctness:
 * rotation is a compare-and-swap server-side, so parallel refreshes converge on
 * the same successor instead of all but the first reading as a replay. What it
 * still buys is N-1 round-trips when a page mounts several queries that expire
 * together, and their share of the 30-per-minute refresh budget.
 */
export const refreshSession = (): Promise<boolean> =>
  (inFlightRefresh ??= requestRefresh().finally(() => {
    inFlightRefresh = null;
  }));

const execute = async <T>(url: string, options: RequestInit, mayRetry: boolean): Promise<T> => {
  const res = await fetch(url, withAuthorization(options));

  const rawBody = STATUSES_WITHOUT_BODY.includes(res.status) ? null : await res.text();
  const data = parseBody(rawBody, res.headers.get('content-type') ?? '');

  if (!res.ok) {
    if (res.status === 401 && mayRetry && isRetryable(url) && (await refreshSession())) {
      return execute<T>(url, options, false);
    }

    throw new ApiError({
      status: res.status,
      statusText: res.statusText,
      url,
      data,
    });
  }

  return { data, status: res.status, headers: res.headers } as T;
};

/**
 * Orval mutator for the `fetch` client (see orval.config.ts).
 *
 * Orval's default fetch implementation resolves whatever the server returned,
 * so a 401 or a 400 looked exactly like a success to the caller. This wrapper
 * rejects with an `ApiError` on any non-2xx response, attaches the bearer
 * token, and replays a request once after a single-flight refresh on 401.
 */
export const customFetch = async <T>(url: string, options: RequestInit): Promise<T> =>
  execute<T>(url, options, true);
