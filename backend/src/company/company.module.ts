import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CityModule } from '../city/city.module';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';

@Module({
  imports: [AuthModule, CityModule],
  controllers: [CompanyController],
  providers: [CompanyService],
})
export class CompanyModule {}
