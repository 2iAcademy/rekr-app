import { INestApplication } from '@nestjs/common';
import { CityService } from '../src/city/city.service';

/**
 * Clears the city-reference cache between tests.
 *
 * The cache lives on the `CityService` instance, which is created once with the
 * application in `beforeAll` and outlives every `it` of the file. Resetting the
 * database, the throttler and `global.fetch` does not touch it, so a lookup
 * already played in the file would be served from memory and a freshly stubbed
 * answer would never be seen. The suites happen to use a different commune per
 * test today; this stops that from being load-bearing.
 */
export function resetCityCache(app: INestApplication): void {
  app.get(CityService).clearCache();
}
