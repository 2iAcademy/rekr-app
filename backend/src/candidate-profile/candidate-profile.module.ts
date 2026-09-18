import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CityModule } from '../city/city.module';
import { JobFamilyModule } from '../job-family/job-family.module';
import { StorageModule } from '../storage/storage.module';
import { CandidateProfileFileService } from './candidate-profile-file.service';
import { CandidateProfileController } from './candidate-profile.controller';
import { CandidateProfileService } from './candidate-profile.service';

@Module({
  imports: [AuthModule, CityModule, JobFamilyModule, StorageModule],
  controllers: [CandidateProfileController],
  providers: [CandidateProfileService, CandidateProfileFileService],
})
export class CandidateProfileModule {}
