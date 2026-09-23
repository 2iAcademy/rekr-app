import { ConfigService } from '@nestjs/config';
import { AccountService } from './account.service';
import { AccountRetentionService } from './account-retention.service';
import { PrismaService } from '../prisma/prisma.service';

const HOUR_MS = 60 * 60 * 1000;

describe('AccountRetentionService scheduling', () => {
  let service: AccountRetentionService;
  let purge: jest.SpyInstance;

  const build = (interval: string | undefined) => {
    const config = {
      get: jest.fn().mockReturnValue(interval),
    } as unknown as ConfigService;
    service = new AccountRetentionService(
      {} as PrismaService,
      {} as AccountService,
      config,
    );
    purge = jest.spyOn(service, 'purgeInactive').mockResolvedValue(0);
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    service.onApplicationShutdown();
    jest.useRealTimers();
  });

  it('purges at boot, then once a day by default', () => {
    build(undefined);

    service.onApplicationBootstrap();
    expect(purge).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(24 * HOUR_MS);
    expect(purge).toHaveBeenCalledTimes(2);
  });

  it('follows ACCOUNT_PURGE_INTERVAL_HOURS', () => {
    build('6');

    service.onApplicationBootstrap();
    jest.advanceTimersByTime(12 * HOUR_MS);

    expect(purge).toHaveBeenCalledTimes(3);
  });

  it('never runs when the interval is 0', () => {
    build('0');

    service.onApplicationBootstrap();
    jest.advanceTimersByTime(48 * HOUR_MS);

    expect(purge).not.toHaveBeenCalled();
  });

  it('stops on shutdown', () => {
    build('1');

    service.onApplicationBootstrap();
    service.onApplicationShutdown();
    jest.advanceTimersByTime(5 * HOUR_MS);

    expect(purge).toHaveBeenCalledTimes(1);
  });

  it.each(['-1', '1.5', 'daily'])(
    'refuses to start on the interval %p',
    (interval) => {
      build(interval);

      expect(() => service.onApplicationBootstrap()).toThrow(
        /ACCOUNT_PURGE_INTERVAL_HOURS/,
      );
    },
  );
});
