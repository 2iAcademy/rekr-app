import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LikeController } from './like.controller';
import { LikeService } from './like.service';

@Module({
  imports: [AuthModule],
  controllers: [LikeController],
  providers: [LikeService],
})
export class LikeModule {}
