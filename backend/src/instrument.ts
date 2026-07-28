import * as Sentry from '@sentry/nestjs';

/**
 * Sentry initialisation, kept in its own module so it can be imported before
 * anything else.
 *
 * `SentryModule.forRoot()` and `SentryGlobalFilter` in `AppModule` only connect
 * NestJS to an SDK that is already running — they do not start it. Without this
 * file the packages were installed, the module was wired, and every
 * `captureException` was a silent no-op: errors looked reported and were not.
 *
 * The import must stay the first statement of `main.ts`: the SDK patches
 * modules (HTTP, Postgres, …) as they load, so anything imported earlier is
 * never instrumented. `instrument.spec.ts` asserts that ordering.
 */
const dsn = process.env.SENTRY_DSN?.trim();

/**
 * No DSN means no telemetry backend, so the SDK stays off rather than buffering
 * events nobody will read. This is the normal state in tests and in a local
 * checkout, and it must not require any other configuration to be safe.
 */
const enabled = Boolean(dsn);

/**
 * Tracing is opt-in and off by default: it is billed per transaction, and error
 * reporting — the thing that was missing — does not need it. Raise
 * `SENTRY_TRACES_SAMPLE_RATE` when performance data is actually wanted.
 */
function readTracesSampleRate(): number {
  const raw = process.env.SENTRY_TRACES_SAMPLE_RATE?.trim();
  if (!raw) {
    return 0;
  }

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(
      `SENTRY_TRACES_SAMPLE_RATE must be a number between 0 and 1, received "${raw}".`,
    );
  }

  return parsed;
}

Sentry.init({
  dsn,
  enabled,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: readTracesSampleRate(),
});
