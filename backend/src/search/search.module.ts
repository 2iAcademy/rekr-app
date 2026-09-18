import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OfferSearchService } from './offer-search.service';

@Module({
  imports: [PrismaModule],
  providers: [OfferSearchService],
  exports: [OfferSearchService],
})
export class SearchModule {}
