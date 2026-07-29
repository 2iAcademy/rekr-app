import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { KafkaModule } from '../kafka/kafka.module';
import { LogsController } from './logs.controller';

@Module({
  imports: [AuthModule, KafkaModule],
  controllers: [LogsController],
})
export class LogsModule {}
