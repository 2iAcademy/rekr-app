import * as Sentry from '@sentry/react';
const dsn = import.meta.env.VITE_SENTRY_DSN;

Sentry.init({
  dsn,
  debug: import.meta.env.MODE === 'development',
  enabled: Boolean(dsn),
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
  sendDefaultPii: true,
});
