import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../../generated/prisma/client';
import {
  PrismaExceptionFilter,
  translatePrismaError,
} from './prisma-exception.filter';

const captureException = jest.fn<void, [unknown]>();
jest.mock('@sentry/nestjs', () => ({
  captureException: (exception: unknown): void => {
    captureException(exception);
  },
}));

const knownError = (
  code: string,
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError(
    `Invalid \`prisma.company.create()\` invocation:\nUnique constraint failed on the fields: (\`fk_sector\`)`,
    { code, clientVersion: '7.8.0', meta },
  );

describe('translatePrismaError', () => {
  it('turns a unique constraint violation into a 409', () => {
    const result = translatePrismaError(
      knownError('P2002', {
        modelName: 'CandidateProfile',
        driverAdapterError: {
          cause: { constraint: { fields: ['fk_user'] } },
        },
      }),
    );

    expect(result).toBeInstanceOf(ConflictException);
    expect(result?.getStatus()).toBe(HttpStatus.CONFLICT);
  });

  it('turns a foreign key violation into a 400', () => {
    const result = translatePrismaError(
      knownError('P2003', { modelName: 'Company' }),
    );

    expect(result).toBeInstanceOf(BadRequestException);
    expect(result?.getStatus()).toBe(HttpStatus.BAD_REQUEST);
  });

  it('turns an out-of-range value into a 400', () => {
    const result = translatePrismaError(
      knownError('P2020', { modelName: 'Offer' }),
    );

    expect(result).toBeInstanceOf(BadRequestException);
    expect(result?.getStatus()).toBe(HttpStatus.BAD_REQUEST);
  });

  it('turns a missing required record into a 404', () => {
    const result = translatePrismaError(
      knownError('P2025', { modelName: 'Company', operation: 'an update' }),
    );

    expect(result).toBeInstanceOf(NotFoundException);
    expect(result?.getStatus()).toBe(HttpStatus.NOT_FOUND);
  });

  /**
   * Anything not listed above is a bug or an infrastructure failure, not a
   * malformed request. Returning `null` is what keeps it a reported 500 instead
   * of a silently swallowed 400.
   */
  it.each(['P1001', 'P2024', 'P2028', 'P5000'])(
    'leaves %s untranslated',
    (code) => {
      expect(translatePrismaError(knownError(code))).toBeNull();
    },
  );

  it('never leaks the Prisma message, the model or the constraint', () => {
    const result = translatePrismaError(
      knownError('P2003', {
        modelName: 'Company',
        driverAdapterError: {
          cause: {
            constraint: { index: 'company_fk_sector_fkey' },
            originalMessage:
              'insert or update on table "company" violates foreign key constraint "company_fk_sector_fkey"',
          },
        },
      }),
    );

    const serialized = JSON.stringify(result?.getResponse());
    expect(serialized).not.toContain('company_fk_sector_fkey');
    expect(serialized).not.toContain('fk_sector');
    expect(serialized).not.toContain('Company');
    expect(serialized).not.toContain('prisma');
  });
});

/**
 * Translating an exception is what removes it from the Sentry catch-all
 * registered next to this filter. For P2003 and P2020 that is the point: a
 * client sent a bad sector id or an unstorable number, and there is nothing to
 * investigate.
 *
 * P2002 and P2025 are different. Every service pre-checks them, so reaching
 * one through HTTP means either a genuine race — worth knowing about, because
 * it is the double-submit the UI should be preventing — or a pre-check that no
 * longer matches the constraint it guards, which is a bug. Answering 409 or
 * 404 is still correct for the caller; staying silent towards Sentry is not.
 */
describe('PrismaExceptionFilter reporting', () => {
  let filter: PrismaExceptionFilter;
  let delegated: jest.SpyInstance<void, [unknown, ArgumentsHost]>;

  const host = {} as ArgumentsHost;

  beforeEach(() => {
    captureException.mockClear();
    filter = new PrismaExceptionFilter();
    delegated = jest
      .spyOn(BaseExceptionFilter.prototype, 'catch')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    delegated.mockRestore();
  });

  it.each(['P2002', 'P2025'])(
    'reports %s to Sentry even though it answers a 4xx',
    (code) => {
      filter.catch(knownError(code), host);

      expect(captureException).toHaveBeenCalledTimes(1);
      const [reported] = captureException.mock.calls[0];
      expect(reported).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    },
  );

  it.each(['P2003', 'P2020'])(
    'stays silent on %s, which is the client being wrong',
    (code) => {
      filter.catch(knownError(code), host);

      expect(captureException).not.toHaveBeenCalled();
    },
  );

  it('still reports an untranslated code', () => {
    filter.catch(knownError('P2024'), host);

    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('answers the translated status, not the raw Prisma error', () => {
    filter.catch(knownError('P2002'), host);

    expect(delegated).toHaveBeenCalledTimes(1);
    const [forwarded] = delegated.mock.calls[0];
    expect(forwarded).toBeInstanceOf(ConflictException);
  });
});
