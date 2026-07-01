import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  createErrorLogEvent,
  createSampleLogEvent,
} from '../kafka/log-event';
import { KafkaLogPublisherService } from '../kafka/kafka-log-publisher.service';

@Controller('logs')
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
  async publishError(@Body('message') message?: string) {
    const event = createErrorLogEvent(
      message?.trim() || 'Simulated error log emitted to Kafka',
    );
    const delivery = await this.kafkaLogPublisher.publish(event);

    return {
      topic: this.kafkaLogPublisher.topicName,
      event,
      delivery,
    };
  }
}
