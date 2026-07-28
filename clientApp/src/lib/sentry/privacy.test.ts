import { describe, it, expect } from 'vitest';
import type { Breadcrumb, ErrorEvent } from '@sentry/react';
import {
  REDACTED,
  isSensitiveKey,
  redactSensitiveData,
  scrubBreadcrumb,
  scrubEvent,
} from './privacy';

describe('isSensitiveKey', () => {
  it.each([
    'password',
    'Password',
    'newPassword',
    'password_confirmation',
    'token',
    'accessToken',
    'refresh_token',
    'authorization',
    'secret',
    'apiKey',
    'api_key',
    'credential',
    'otp',
  ])('flags %s as sensitive', (key) => {
    expect(isSensitiveKey(key)).toBe(true);
  });

  it.each(['email', 'userType', 'status', 'message', 'url', 'firstName'])(
    'does not flag %s',
    (key) => {
      expect(isSensitiveKey(key)).toBe(false);
    },
  );
});

describe('redactSensitiveData', () => {
  it('redacts a sensitive value at the top level', () => {
    expect(redactSensitiveData({ email: 'user@rekr.fr', password: 'sup3rs3cret' })).toEqual({
      email: 'user@rekr.fr',
      password: REDACTED,
    });
  });

  it('redacts nested sensitive values while keeping their siblings', () => {
    const input = { body: { form: { password: 'sup3rs3cret', email: 'user@rekr.fr' } } };

    expect(redactSensitiveData(input)).toEqual({
      body: { form: { password: REDACTED, email: 'user@rekr.fr' } },
    });
  });

  it('redacts a whole object held under a sensitive key', () => {
    const input = { credentials: { password: 'sup3rs3cret', email: 'user@rekr.fr' } };

    expect(redactSensitiveData(input)).toEqual({ credentials: REDACTED });
  });

  it('redacts inside arrays', () => {
    const input = [{ password: 'a' }, { email: 'b@rekr.fr' }];

    expect(redactSensitiveData(input)).toEqual([{ password: REDACTED }, { email: 'b@rekr.fr' }]);
  });

  it('leaves primitives untouched', () => {
    expect(redactSensitiveData('hello')).toBe('hello');
    expect(redactSensitiveData(42)).toBe(42);
    expect(redactSensitiveData(null)).toBeNull();
    expect(redactSensitiveData(undefined)).toBeUndefined();
  });

  it('does not mutate the input object', () => {
    const input = { password: 'sup3rs3cret' };

    redactSensitiveData(input);

    expect(input.password).toBe('sup3rs3cret');
  });

  it('survives circular references', () => {
    const input: Record<string, unknown> = { password: 'sup3rs3cret' };
    input.self = input;

    const result = redactSensitiveData(input) as Record<string, unknown>;

    expect(result.password).toBe(REDACTED);
    expect(result.self).toBe('[Circular]');
  });

  it('redacts sensitive fields carried by an Error instance', () => {
    const error = Object.assign(new Error('boom'), { password: 'sup3rs3cret', status: 401 });

    const result = redactSensitiveData(error) as Record<string, unknown>;

    expect(result.password).toBe(REDACTED);
    expect(result.status).toBe(401);
  });
});

/**
 * The depth limit exists so a hostile or cyclic payload cannot hang the hook.
 * It must not become a way through the filter: returning the raw subtree at the
 * limit means a credential nested deeply enough is shipped verbatim, and the
 * nesting depth of a Sentry payload is not something this code controls.
 */
describe('redactSensitiveData depth limit', () => {
  const nest = (depth: number, leaf: Record<string, unknown>): Record<string, unknown> => {
    let current: Record<string, unknown> = leaf;
    for (let i = 0; i < depth; i += 1) {
      current = { level: current };
    }
    return current;
  };

  it('never returns a raw subtree once the depth limit is reached', () => {
    const input = nest(30, { password: 'sup3rs3cret' });

    expect(JSON.stringify(redactSensitiveData(input))).not.toContain('sup3rs3cret');
  });

  it('truncates instead of recursing forever', () => {
    const serialized = JSON.stringify(redactSensitiveData(nest(30, { email: 'user@rekr.fr' })));

    expect(serialized).toContain('[Truncated]');
  });

  it('still redacts normally within the limit', () => {
    const input = nest(3, { password: 'sup3rs3cret', email: 'user@rekr.fr' });
    const serialized = JSON.stringify(redactSensitiveData(input));

    expect(serialized).not.toContain('sup3rs3cret');
    expect(serialized).toContain('user@rekr.fr');
  });
});

/**
 * `typeof x === 'object'` is true for Date, Map and Set, and `Object.entries`
 * returns nothing for all three. Walking them as plain records silently
 * replaces them with `{}` — the breadcrumb still arrives, minus the one value
 * that made it worth reading.
 */
describe('redactSensitiveData on non-plain objects', () => {
  it('keeps a Date intact', () => {
    const date = new Date('2026-07-28T10:00:00.000Z');

    expect(redactSensitiveData({ occurredAt: date })).toEqual({ occurredAt: date });
  });

  it('does not flatten a Map into an empty object', () => {
    const input = { cache: new Map([['a', 1]]) };

    expect(redactSensitiveData(input)).not.toEqual({ cache: {} });
  });

  it('does not flatten a Set into an empty object', () => {
    const input = { tags: new Set(['a']) };

    expect(redactSensitiveData(input)).not.toEqual({ tags: {} });
  });
});

describe('scrubBreadcrumb', () => {
  it('redacts credentials logged through console.error', () => {
    const breadcrumb: Breadcrumb = {
      category: 'console',
      message: 'login failed',
      data: {
        logger: 'console',
        arguments: [{ email: 'user@rekr.fr', password: 'sup3rs3cret' }],
      },
    };

    const result = scrubBreadcrumb(breadcrumb);

    expect(result?.data?.arguments).toEqual([{ email: 'user@rekr.fr', password: REDACTED }]);
  });

  it('drops a console breadcrumb whose message text exposes a credential', () => {
    const breadcrumb: Breadcrumb = {
      category: 'console',
      message: 'submitting {"password":"sup3rs3cret"}',
    };

    expect(scrubBreadcrumb(breadcrumb)).toBeNull();
  });

  it('keeps a fetch breadcrumb intact', () => {
    const breadcrumb: Breadcrumb = {
      category: 'fetch',
      type: 'http',
      data: { method: 'POST', url: '/api/auth/login', status_code: 401 },
    };

    expect(scrubBreadcrumb(breadcrumb)).toEqual(breadcrumb);
  });

  it('strips the query string from navigation breadcrumbs', () => {
    const breadcrumb: Breadcrumb = {
      category: 'navigation',
      data: { from: '/signin', to: '/reset?token=abc123' },
    };

    const result = scrubBreadcrumb(breadcrumb);

    expect(result?.data?.to).toBe('/reset');
  });

  it('returns a breadcrumb without data unchanged', () => {
    const breadcrumb: Breadcrumb = { category: 'ui.click', message: 'button#submit' };

    expect(scrubBreadcrumb(breadcrumb)).toEqual(breadcrumb);
  });
});

describe('scrubEvent', () => {
  it('redacts sensitive extra data', () => {
    const event = {
      extra: { payload: { email: 'user@rekr.fr', password: 'sup3rs3cret' } },
    } as unknown as ErrorEvent;

    const result = scrubEvent(event);

    expect(result.extra?.payload).toEqual({ email: 'user@rekr.fr', password: REDACTED });
  });

  it('redacts request data and drops the query string from the request url', () => {
    const event = {
      request: {
        url: 'https://rekr.fr/reset?token=abc123',
        data: { password: 'sup3rs3cret' },
      },
    } as unknown as ErrorEvent;

    const result = scrubEvent(event);

    expect(result.request?.url).toBe('https://rekr.fr/reset');
    expect(result.request?.data).toEqual({ password: REDACTED });
  });

  it('never attaches a user ip address', () => {
    const event = { user: { ip_address: '203.0.113.7', id: 'u-1' } } as unknown as ErrorEvent;

    const result = scrubEvent(event);

    expect(result.user?.ip_address).toBeUndefined();
    expect(result.user?.id).toBe('u-1');
  });

  it('leaves an event without pii untouched', () => {
    const event = { message: 'boom', level: 'error' } as unknown as ErrorEvent;

    expect(scrubEvent(event)).toEqual(event);
  });
});
