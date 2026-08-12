import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SentryModule } from '@sentry/nestjs/setup';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { buildThrottlerOptions } from './common/throttling/throttling.config';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaExceptionFilter } from './prisma/prisma-exception.filter';
import { LogsModule } from './logs/logs.module';
import { AuthModule } from './auth/auth.module';
import { CandidateProfileModule } from './candidate-profile/candidate-profile.module';
import { CityModule } from './city/city.module';
import { CompanyModule } from './company/company.module';
import { OfferModule } from './offer/offer.module';
import { SectorModule } from './sector/sector.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildThrottlerOptions,
    }),
    PrismaModule,
    LogsModule,
    AuthModule,
    CandidateProfileModule,
    CityModule,
    CompanyModule,
    OfferModule,
    SectorModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    // Declared after the Sentry catch-all so that it is matched first: Nest
    // reverses the filter list before selecting one, so the last declared wins.
    // Order matters here. See `PrismaExceptionFilter.catch` for the mechanism.
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AppService,
  ],
})
export class AppModule {}
