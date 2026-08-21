import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Standalone Vitest config: we intentionally don't reuse vite.config's plugin
// chain (PWA, Sentry) — it's noise in tests. Only the React plugin (JSX) and
// the `@` alias are needed to resolve app imports.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    // The journey specs drive whole wizards through the real stack; under
    // v8 coverage on a 2-vCPU runner they sit close to the 5s default.
    testTimeout: 20000,
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
      // 80% threshold scoped to the feature actually under test. A global
      // threshold would penalise untested UI primitives and turn coverage into
      // a markup-chasing game. Sonar enforces 80% on new code separately.
      thresholds: {
        'src/components/form/**': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        'src/components/wizard/**': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        'src/features/candidate-onboarding/**': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        'src/features/onboarding/**': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        'src/features/recruiter-onboarding/**': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        'src/features/matches/**': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
  },
});
