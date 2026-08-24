import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { captureException } from '@sentry/nestjs';
import { Prisma } from '../../generated/prisma/client';

/**
 * Prisma error codes this codebase can actually raise, and nothing else.
 *
 * Verified against Prisma 7.8 on the real schema rather than transcribed from
 * the reference table — the mapping is only worth what the codes are worth:
 *
 *  - P2002, unique violation. Every service pre-checks with a `findUnique`
 *    inside its transaction, so through HTTP this needs a race: two parallel
 *    creates for the same `userId`. It happens on a double-clicked button.
 *  - P2003, foreign key violation. Reachable on a first try: `sectorId` is an
 *    optional `Int` on the company DTO, and nothing checks the sector exists.
 *  - P2020, value out of range. Also reachable on a first try: `salaryMin`
 *    is `@IsInt() @Min(0)` with no ceiling over an `int4` column.
 *  - P2025, required record missing. Same race as P2002, in the other
 *    direction: the row is deleted between the pre-check and the update.
 *
 * Everything else — P1001 unreachable database, P2024 pool timeout, P2028 dead
 * transaction — is infrastructure or a bug. Those must stay a reported 500;
 * dressing them up as a 400 would blame the client for an outage and hide it
 * from Sentry.
 */
const HTTP_STATUS_BY_PRISMA_CODE: Record<string, () => HttpException> = {
  P2002: () => new ConflictException('This resource already exists.'),
  P2003: () => new BadRequestException('A referenced resource does not exist.'),
  P2020: () =>
    new BadRequestException('A value is out of range for its field.'),
  P2025: () => new NotFoundException('The requested resource does not exist.'),
};

/**
 * Translated codes that must still be reported.
 *
 * P2003 and P2020 are the client sending a bad value; there is nothing to
 * investigate and reporting them would be noise proportional to traffic.
 *
 * P2002 and P2025 are not in that category. Both are pre-checked by a
 * `findUnique` in every service that can raise them, so reaching one through
 * HTTP means the pre-check did not hold: either a real race — the double
 * submit the UI should be preventing — or a pre-check that has drifted from
 * the constraint it guards. The caller still deserves its 409 or 404, but
 * translating the exception is precisely what takes it away from the Sentry
 * catch-all, and a silent 409 is a bug that never surfaces.
 */
const REPORTED_TRANSLATED_CODES = new Set(['P2002', 'P2025']);

/**
 * Maps a Prisma error onto an HTTP one, or `null` when it has no client-facing
 * meaning.
 *
 * The messages are deliberately generic. `exception.message` carries the failing
 * query and `exception.meta` carries the constraint name and the physical
 * column (`company_fk_sector_fkey`, `fk_sector`) — a free schema disclosure for
 * anyone probing the API, and nothing a client can act on.
 */
export function translatePrismaError(
  exception: Prisma.PrismaClientKnownRequestError,
): HttpException | null {
  const build = HTTP_STATUS_BY_PRISMA_CODE[exception.code];
  return build ? build() : null;
}

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  /**
   * Registered after `SentryGlobalFilter` in `AppModule` on purpose, so that
   * this filter is the one matched first.
   *
   * The mechanism is not the registration order it looks like:
   * `ApplicationConfig.addGlobalFilter` *pushes* onto `globalFilters`
   * (`@nestjs/core/application-config.js`), and the reversal happens later, in
   * `RouterExceptionFilters.create`, which calls `filters.reverse()` before
   * `setCustomFilters` (`@nestjs/core/router/router-exception-filters.js`).
   * `selectExceptionFilterMetadata` then takes the first match. Net effect:
   * last declared wins. Declared before Sentry's `@Catch()`-all, this filter
   * would never run — but anyone verifying the claim against `addGlobalFilter`
   * alone would read a `push` and conclude the opposite, so the reason is
   * spelled out rather than asserted.
   *
   * Sentry reporting is done by hand here because handling an exception is
   * what removes it from the catch-all that would otherwise have reported it.
   * `captureException` runs inside the request's isolation scope, so the HTTP
   * context Sentry attaches per request is still on the event.
   */
  catch(
    exception: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ): void {
    const translated = translatePrismaError(exception);

    if (!translated) {
      captureException(exception);
      super.catch(exception, host);
      return;
    }

    if (REPORTED_TRANSLATED_CODES.has(exception.code)) {
      captureException(exception);
    }

    super.catch(translated, host);
  }
}
