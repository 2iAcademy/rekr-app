import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CandidateProfileController } from './candidate-profile.controller';
import { CandidateProfileService } from './candidate-profile.service';

@Module({
  imports: [AuthModule],
  controllers: [CandidateProfileController],
  providers: [CandidateProfileService],
})
export class CandidateProfileModule {}
