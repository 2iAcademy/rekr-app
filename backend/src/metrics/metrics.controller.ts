import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getMetrics(@Res() response: Response): Promise<void> {
    const metrics = await this.metricsService.getMetrics();

    response.setHeader('Content-Type', this.metricsService.contentType);
    response.send(metrics);
  }
}
