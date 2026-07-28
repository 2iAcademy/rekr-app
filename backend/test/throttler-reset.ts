import { INestApplication } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';

/**
 * Clears the in-memory rate-limit counters between tests.
 *
 * Supertest always reaches the app from 127.0.0.1, so every test inside a spec
 * file shares the same rate-limit bucket. Without this reset, a test that
 * deliberately exhausts the quota would poison the next one and the suite would
 * become order-dependent.
 *
 * `ThrottlerStorageService` schedules one timer per recorded hit, and each timer
 * dereferences the record it belongs to when it fires. Dropping the records
 * without cancelling the timers first would throw inside a `setTimeout`
 * callback, outside of any test. `onApplicationShutdown` is the public way to
 * cancel them all.
 */
export function resetThrottler(app: INestApplication): void {
  const storage = app.get<ThrottlerStorage>(ThrottlerStorage, {
    strict: false,
  });

  if (!(storage instanceof ThrottlerStorageService)) {
    return;
  }

  storage.onApplicationShutdown();
  storage.storage.clear();
}
