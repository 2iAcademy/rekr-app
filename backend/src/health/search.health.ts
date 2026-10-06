import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { OfferSearchService } from '../search/offer-search.service';

@Injectable()
export class SearchHealthIndicator {
  constructor(
    private readonly offerSearch: OfferSearchService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy<const Key extends string>(key: Key) {
    const indicator = this.healthIndicatorService.check(key);

    switch (await this.offerSearch.availability()) {
      case 'available':
        return indicator.up();
      case 'disabled':
        return indicator.up({ mode: 'disabled' });
      case 'unavailable':
        return indicator.down();
    }
  }
}
