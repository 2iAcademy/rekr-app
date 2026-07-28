import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OfferController } from './offer.controller';
import { OfferService } from './offer.service';

@Module({
  imports: [AuthModule],
  controllers: [OfferController],
  providers: [OfferService],
})
export class OfferModule {}
