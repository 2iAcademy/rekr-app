import { HealthIndicatorService } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './database.health';

describe('DatabaseHealthIndicator', () => {
  const prisma = { $queryRaw: jest.fn() };
  const indicatorOf = () =>
    new DatabaseHealthIndicator(prisma as never, new HealthIndicatorService());

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('is up when PostgreSQL answers', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(indicatorOf().isHealthy('database')).resolves.toEqual({
      database: { status: 'up' },
    });
  });

  it('is down without echoing the driver error', async () => {
    prisma.$queryRaw.mockRejectedValue(
      new Error('Can\'t reach database server at "db.internal:5432" as rekr'),
    );

    const result = await indicatorOf().isHealthy('database');

    expect(result).toEqual({ database: { status: 'down' } });
    expect(JSON.stringify(result)).not.toContain('db.internal');
  });

  it('is down when PostgreSQL hangs', async () => {
    jest.useFakeTimers();
    prisma.$queryRaw.mockReturnValue(new Promise(() => undefined));

    const pending = indicatorOf().isHealthy('database');
    await jest.advanceTimersByTimeAsync(3000);

    await expect(pending).resolves.toEqual({ database: { status: 'down' } });
  });
});
