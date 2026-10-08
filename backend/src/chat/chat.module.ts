import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { streamClientProvider } from './stream-client.provider';

@Module({
  imports: [AuthModule],
  controllers: [ChatController],
  providers: [ChatService, streamClientProvider],
  exports: [ChatService],
})
export class ChatModule {}
