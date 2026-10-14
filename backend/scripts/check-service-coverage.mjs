// Fails the run when the unit-test coverage of the services drops below the
// floor, the way the frontend thresholds already do.
//
// Jest checks a threshold set on a glob file by file, and some services are
// mostly covered by the e2e suite (account.service.ts), so a per-file floor
// would fail today. The floor is therefore checked on the services taken
// together, from the json-summary report of `npm run test:cov`. Controllers
// and modules are left out: the e2e suite covers them, and it does not count
// here.
//
// Usage: node scripts/check-service-coverage.mjs [path/to/coverage-summary.json]

import { readFileSync } from 'node:fs';

const FLOOR = { lines: 80, statements: 80, functions: 75, branches: 70 };

const path = process.argv[2] ?? 'coverage/coverage-summary.json';
const summary = JSON.parse(readFileSync(path, 'utf8'));

const services = Object.entries(summary).filter(([file]) =>
  file.endsWith('.service.ts'),
);
if (services.length === 0) {
  console.error(`No *.service.ts file in ${path}: nothing was measured.`);
  process.exit(1);
}

let failed = false;
console.log(`Coverage of the ${services.length} services, taken together:`);
for (const [metric, floor] of Object.entries(FLOOR)) {
  const covered = services.reduce(
    (sum, [, file]) => sum + file[metric].covered,
    0,
  );
  const total = services.reduce((sum, [, file]) => sum + file[metric].total, 0);
  const pct = total === 0 ? 100 : (100 * covered) / total;
  const ok = pct >= floor;
  failed ||= !ok;
  console.log(
    `  ${metric.padEnd(10)} ${pct.toFixed(1).padStart(5)} %  (floor ${floor} %)  ${ok ? 'ok' : 'BELOW'}`,
  );
}

if (failed) {
  console.error('Service coverage is below its floor.');
  process.exit(1);
}
