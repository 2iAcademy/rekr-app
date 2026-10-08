import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { SearchModule } from '../search/search.module';
import { DatabaseHealthIndicator } from './database.health';
import { HealthController } from './health.controller';
import { SearchHealthIndicator } from './search.health';

@Module({
  imports: [TerminusModule, SearchModule],
  controllers: [HealthController],
  providers: [DatabaseHealthIndicator, SearchHealthIndicator],
})
export class HealthModule {}
