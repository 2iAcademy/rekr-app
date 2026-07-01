import { Module } from '@nestjs/common';
import { KafkaModule } from '../kafka/kafka.module';
import { LogsController } from './logs.controller';

@Module({
  imports: [KafkaModule],
  controllers: [LogsController],
})
export class LogsModule {}
