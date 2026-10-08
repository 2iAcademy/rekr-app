import { HealthIndicatorService } from '@nestjs/terminus';
import { SearchHealthIndicator } from './search.health';

describe('SearchHealthIndicator', () => {
  const offerSearch = { availability: jest.fn() };
  const indicatorOf = () =>
    new SearchHealthIndicator(
      offerSearch as never,
      new HealthIndicatorService(),
    );

  it('is up when the offers index is reachable', async () => {
    offerSearch.availability.mockResolvedValue('available');

    await expect(indicatorOf().isHealthy('search')).resolves.toEqual({
      search: { status: 'up' },
    });
  });

  it('is up and says so when Elasticsearch is disabled', async () => {
    offerSearch.availability.mockResolvedValue('disabled');

    await expect(indicatorOf().isHealthy('search')).resolves.toEqual({
      search: { status: 'up', mode: 'disabled' },
    });
  });

  it('is down when the offers index is unreachable', async () => {
    offerSearch.availability.mockResolvedValue('unavailable');

    await expect(indicatorOf().isHealthy('search')).resolves.toEqual({
      search: { status: 'down' },
    });
  });
});
