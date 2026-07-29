import type { Breadcrumb, ErrorEvent } from '@sentry/react';

export const REDACTED = '[Filtered]';

const CIRCULAR = '[Circular]';

const TRUNCATED = '[Truncated]';

const MAX_DEPTH = 8;

const SENSITIVE_KEY_PATTERN =
  /pass(word|phrase)?|token|secret|authorization|auth[-_]?header|credential|api[-_]?key|otp|pin|cvv|session[-_]?id/i;

/**
 * Matches a credential-looking key/value pair inside a free-text string, e.g.
 * `{"password":"hunter2"}` or `password=hunter2`.
 */
const SENSITIVE_TEXT_PATTERN =
  /(pass(word|phrase)?|token|secret|authorization|credential|api[-_]?key|otp)["']?\s*[:=]\s*["']?[^\s"',}]+/i;

export const isSensitiveKey = (key: string): boolean => SENSITIVE_KEY_PATTERN.test(key);

export const stripQueryString = (url: string): string => url.split('?')[0].split('#')[0];

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * `typeof x === 'object'` is also true for Date, Map, Set and RegExp, and
 * `Object.entries` returns nothing for any of them. Walking them as records
 * replaces each one with `{}` — the breadcrumb still reaches Sentry, minus the
 * only value that made it worth reading.
 *
 * Date and RegExp are handed back untouched: neither can hide a credential.
 * Map and Set are replaced by a marker rather than walked, because their
 * contents are not reachable through `Object.entries` and copying them out
 * would mean re-implementing redaction for two more shapes. Everything else
 * that is an object — arrays, plain records, Errors, class instances — is
 * still walked, so own enumerable credentials keep being redacted.
 */
const summariseExotic = (value: object): unknown | undefined => {
  if (value instanceof Date || value instanceof RegExp) {
    return value;
  }
  if (value instanceof Map) {
    return `[Map size=${value.size}]`;
  }
  if (value instanceof Set) {
    return `[Set size=${value.size}]`;
  }
  return undefined;
};

/**
 * Returns a deep copy of `value` with every value held under a credential-looking
 * key replaced by `[Filtered]`. Cycle-safe and depth-limited, because it runs on
 * arbitrary payloads handed over by the Sentry SDK.
 */
export const redactSensitiveData = (value: unknown): unknown => {
  const seen = new WeakSet<object>();

  const walk = (current: unknown, depth: number): unknown => {
    if (!isPlainRecord(current)) {
      return current;
    }

    const exotic = summariseExotic(current);
    if (exotic !== undefined) {
      return exotic;
    }

    if (seen.has(current)) {
      return CIRCULAR;
    }

    // Returning `current` here would hand back the untouched subtree: a
    // credential nested deeper than the limit would ship verbatim, and the
    // depth of a payload the SDK hands over is not something this code
    // controls. The limit is there to bound the work, not to let anything past.
    if (depth >= MAX_DEPTH) {
      return TRUNCATED;
    }

    seen.add(current);

    if (Array.isArray(current)) {
      return current.map((item) => walk(item, depth + 1));
    }

    const source = current instanceof Error ? errorToRecord(current) : current;

    return Object.fromEntries(
      Object.entries(source).map(([key, entry]) => [
        key,
        isSensitiveKey(key) ? REDACTED : walk(entry, depth + 1),
      ]),
    );
  };

  return walk(value, 0);
};

const errorToRecord = (error: Error): Record<string, unknown> => ({
  name: error.name,
  message: error.message,
  ...Object.fromEntries(Object.entries(error)),
});

/**
 * `beforeBreadcrumb` hook. Console breadcrumbs carry their raw arguments to
 * Sentry, so anything logged on the sign-in / sign-up screens would be shipped
 * verbatim. Drops the breadcrumb entirely when its free-text message exposes a
 * credential, and redacts structured data otherwise.
 */
export const scrubBreadcrumb = (breadcrumb: Breadcrumb): Breadcrumb | null => {
  if (typeof breadcrumb.message === 'string' && SENSITIVE_TEXT_PATTERN.test(breadcrumb.message)) {
    return null;
  }

  if (!breadcrumb.data) {
    return breadcrumb;
  }

  const data = redactSensitiveData(breadcrumb.data) as Record<string, unknown>;

  for (const key of ['to', 'from', 'url']) {
    if (typeof data[key] === 'string') {
      data[key] = stripQueryString(data[key]);
    }
  }

  return { ...breadcrumb, data };
};

/**
 * `beforeSend` hook. Belt and braces on top of `sendDefaultPii: false`: strips
 * any inferred IP address and redacts credentials from the payloads the app
 * itself may have attached.
 */
export const scrubEvent = (event: ErrorEvent): ErrorEvent => {
  if (event.user?.ip_address) {
    delete event.user.ip_address;
  }

  if (event.extra) {
    event.extra = redactSensitiveData(event.extra) as ErrorEvent['extra'];
  }

  if (event.request) {
    if (typeof event.request.url === 'string') {
      event.request.url = stripQueryString(event.request.url);
    }

    if (event.request.data) {
      event.request.data = redactSensitiveData(event.request.data);
    }

    if (event.request.query_string) {
      delete event.request.query_string;
    }

    if (event.request.cookies) {
      delete event.request.cookies;
    }
  }

  return event;
};
