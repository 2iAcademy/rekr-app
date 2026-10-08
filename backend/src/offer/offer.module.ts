import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { CityModule } from '../city/city.module';
import { JobFamilyModule } from '../job-family/job-family.module';
import { MatchModule } from '../match/match.module';
import { SearchModule } from '../search/search.module';
import { OfferController } from './offer.controller';
import { OfferService } from './offer.service';

@Module({
  imports: [
    AuthModule,
    ChatModule,
    CityModule,
    JobFamilyModule,
    MatchModule,
    SearchModule,
  ],
  controllers: [OfferController],
  providers: [OfferService],
})
export class OfferModule {}
