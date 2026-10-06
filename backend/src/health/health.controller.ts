import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './database.health';
import { SearchHealthIndicator } from './search.health';

/**
 * Public on purpose: uptime probes and deploy checks do not authenticate.
 * Both routes stay under the default rate limit, since each call reaches a
 * backing service.
 *
 * Elasticsearch has its own route because its outage only degrades the feeds
 * to PostgreSQL ordering. Folding it into `/health` would report the whole API
 * down, and roll back a deploy or restart a backend that can still serve.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
    private readonly search: SearchHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.database.isHealthy('database')]);
  }

  @Get('search')
  @HealthCheck()
  checkSearch() {
    return this.health.check([() => this.search.isHealthy('search')]);
  }
}
