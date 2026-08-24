import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CityModule } from '../city/city.module';
import { StorageModule } from '../storage/storage.module';
import { CompanyFileService } from './company-file.service';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';

@Module({
  imports: [AuthModule, CityModule, StorageModule],
  controllers: [CompanyController],
  providers: [CompanyService, CompanyFileService],
})
export class CompanyModule {}
