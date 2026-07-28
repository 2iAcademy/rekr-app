import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ThrottleScope } from '../common/throttling/throttle-scope.decorator';
import { createErrorLogEvent, createSampleLogEvent } from '../kafka/log-event';
import { KafkaLogPublisherService } from '../kafka/kafka-log-publisher.service';
import { PublishErrorLogDto } from './dto/publish-error-log.dto';

/**
 * Both routes are pipeline simulators: they push a synthetic event into Kafka.
 * Authentication alone is not a gate here — signup is free and instant, so any
 * anonymous visitor could mint a token and write attacker-controlled rows into
 * the observability store. `admin` keeps the manual test capability that this
 * endpoint exists for, without opening it to every account.
 */
@Controller('logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles('admin')
@ThrottleScope('logs')
export class LogsController {
  constructor(private readonly kafkaLogPublisher: KafkaLogPublisherService) {}

  @Post('sample')
  @HttpCode(202)
  async publishSample() {
    const event = createSampleLogEvent();
    const delivery = await this.kafkaLogPublisher.publish(event);

    return {
      topic: this.kafkaLogPublisher.topicName,
      event,
      delivery,
    };
  }

  @Post('error')
  @HttpCode(202)
  async publishError(@Body() dto: PublishErrorLogDto) {
    const event = createErrorLogEvent(
      dto.message?.trim() || 'Simulated error log emitted to Kafka',
    );
    const delivery = await this.kafkaLogPublisher.publish(event);

    return {
      topic: this.kafkaLogPublisher.topicName,
      event,
      delivery,
    };
  }
}
