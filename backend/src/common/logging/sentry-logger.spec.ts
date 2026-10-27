import { requestContext } from '../../observability/failure-log';
import { SentryLogger } from './sentry-logger';

const sentryLogger = {
  info: jest.fn<void, unknown[]>(),
  warn: jest.fn<void, unknown[]>(),
  error: jest.fn<void, unknown[]>(),
  fatal: jest.fn<void, unknown[]>(),
};

jest.mock('@sentry/nestjs', () => ({
  logger: {
    info: (...args: unknown[]): void => sentryLogger.info(...args),
    warn: (...args: unknown[]): void => sentryLogger.warn(...args),
    error: (...args: unknown[]): void => sentryLogger.error(...args),
    fatal: (...args: unknown[]): void => sentryLogger.fatal(...args),
  },
}));

describe('SentryLogger', () => {
  let logger: SentryLogger;
  let stdout: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    logger = new SentryLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function firstLine(): string {
    return String((stdout.mock.calls as unknown[][])[0][0]);
  }

  it('still prints to the console', () => {
    logger.log('Purged 3 accounts', 'AccountRetentionService');

    expect(stdout).toHaveBeenCalledWith(
      expect.stringContaining('Purged 3 accounts'),
    );
  });

  it('copies a log line to Sentry with its context', () => {
    logger.log('Purged 3 accounts', 'AccountRetentionService');

    expect(sentryLogger.info).toHaveBeenCalledWith('Purged 3 accounts', {
      context: 'AccountRetentionService',
    });
  });

  it('copies warnings at the warn level', () => {
    logger.warn(
      'Elasticsearch drift: 2 open offers missing',
      'OfferSearchService',
    );

    expect(sentryLogger.warn).toHaveBeenCalledWith(
      'Elasticsearch drift: 2 open offers missing',
      {
        context: 'OfferSearchService',
      },
    );
  });

  it('keeps the stack of an error apart from its context', () => {
    logger.error(
      'Mail not sent',
      'Error: timeout\n    at send',
      'PasswordResetService',
    );

    expect(sentryLogger.error).toHaveBeenCalledWith('Mail not sent', {
      context: 'PasswordResetService',
      stack: 'Error: timeout\n    at send',
    });
  });

  it('serialises a non-string message', () => {
    logger.log({ event: 'purge', count: 3 }, 'AccountRetentionService');

    expect(sentryLogger.info).toHaveBeenCalledWith(
      '{"event":"purge","count":3}',
      {
        context: 'AccountRetentionService',
      },
    );
  });

  it("leaves Nest's bootstrap lines out of Sentry", () => {
    logger.log('Mapped {/api/health, GET} route', 'RouterExplorer');
    logger.log('AppModule dependencies initialized', 'InstanceLoader');

    expect(sentryLogger.info).not.toHaveBeenCalled();
  });

  it('never ships a logged e-mail, reset link included', () => {
    logger.log(
      'No SMTP host configured — e-mail not sent.\nhttp://localhost/reset?token=abc',
      'LoggingMailSender',
    );

    expect(sentryLogger.info).not.toHaveBeenCalled();
  });

  it('keeps debug and verbose local', () => {
    logger.setLogLevels(['debug', 'verbose']);
    logger.debug('cache hit', 'CityService');
    logger.verbose('cache hit', 'CityService');

    expect(
      Object.values(sentryLogger).some((fn) => fn.mock.calls.length > 0),
    ).toBe(false);
  });

  it('prints one JSON object per line', () => {
    logger.log('Purged 3 accounts', 'AccountRetentionService');

    const line = firstLine();
    expect(JSON.parse(line)).toMatchObject({
      level: 'log',
      service: 'backend',
      context: 'AccountRetentionService',
      message: 'Purged 3 accounts',
    });
    expect(line.trimEnd().split('\n')).toHaveLength(1);
  });

  it('adds the request ID inside a request, to the console and to Sentry', () => {
    requestContext.run({ request_id: 'request-a' }, () => {
      logger.log('Offer published', 'OfferService');
    });

    expect(JSON.parse(firstLine())).toMatchObject({
      request_id: 'request-a',
    });
    expect(sentryLogger.info).toHaveBeenCalledWith('Offer published', {
      context: 'OfferService',
      request_id: 'request-a',
    });
  });

  it('has no request ID outside a request', () => {
    logger.log('Purged 3 accounts', 'AccountRetentionService');

    expect(JSON.parse(firstLine())).not.toHaveProperty('request_id');
  });
});
