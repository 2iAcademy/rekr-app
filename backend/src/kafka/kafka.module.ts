import { Module } from '@nestjs/common';
import { KafkaLogPublisherService } from './kafka-log-publisher.service';

@Module({
  providers: [KafkaLogPublisherService],
  exports: [KafkaLogPublisherService],
})
export class KafkaModule {}
