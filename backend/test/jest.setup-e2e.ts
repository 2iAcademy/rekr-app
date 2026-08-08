/**
 * The e2e database is imposed, never inherited.
 *
 * `resetDb` truncates every table on each `beforeEach`, so the target has to be
 * decided here rather than picked up from the ambient environment. Falling back
 * to the test database only when `DATABASE_URL` was unset did the opposite:
 * inside the backend container the variable is always set — to the application
 * database — so `docker compose exec backend npm run test:e2e` wiped it, seeded
 * reference data included, and a migration already recorded never replays it.
 *
 * `TEST_DATABASE_URL` is the only way to aim the suite elsewhere. CI sets it
 * because its Postgres answers on `localhost`; the default below is the Docker
 * service name used everywhere else.
 */
const targetDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@postgres:5432/rekr_test';

// Last line of defence: a database this suite is allowed to empty says so in
// its name. Anything else is a misconfiguration worth stopping for.
const databaseName = new URL(targetDatabaseUrl).pathname.replace(/^\//, '');
if (!databaseName.includes('test')) {
  throw new Error(
    `Refusing to run the e2e suite against "${databaseName}": it truncates every table, so the database name must contain "test". Set TEST_DATABASE_URL.`,
  );
}

process.env.DATABASE_URL = targetDatabaseUrl;
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.REFRESH_TOKEN_REPLAY_SECONDS =
  process.env.REFRESH_TOKEN_REPLAY_SECONDS || '1';
