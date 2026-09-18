import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CityModule } from '../city/city.module';
import { JobFamilyModule } from '../job-family/job-family.module';
import { OfferController } from './offer.controller';
import { OfferService } from './offer.service';

@Module({
  imports: [AuthModule, CityModule, JobFamilyModule],
  controllers: [OfferController],
  providers: [OfferService],
})
export class OfferModule {}
