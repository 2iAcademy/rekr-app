import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CityModule } from '../city/city.module';
import { CandidateProfileController } from './candidate-profile.controller';
import { CandidateProfileService } from './candidate-profile.service';

@Module({
  imports: [AuthModule, CityModule],
  controllers: [CandidateProfileController],
  providers: [CandidateProfileService],
})
export class CandidateProfileModule {}
