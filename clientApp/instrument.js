import * as Sentry from '@sentry/react';
import { scrubBreadcrumb, scrubEvent } from './src/lib/sentry/privacy';

const dsn = import.meta.env.VITE_SENTRY_DSN;

Sentry.init({
  dsn,
  debug: import.meta.env.MODE === 'development',
  enabled: Boolean(dsn),
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
  // Keep this false: the app renders sign-in / sign-up screens, and `true`
  // makes the SDK report `infer_ip: 'auto'` (visitor IP) and enables cookie,
  // header and request/response body collection.
  sendDefaultPii: false,
  beforeBreadcrumb: scrubBreadcrumb,
  beforeSend: scrubEvent,
});
