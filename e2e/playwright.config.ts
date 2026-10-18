import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests against a running stack: `docker compose up` in CI, or the
 * developer's own one. They create their own accounts through the API, so they
 * need no seed and can run on a database that already holds data.
 */
export default defineConfig({
  testDir: './tests',
  // One scenario, two accounts: running it in parallel would only race the
  // login rate limit.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
