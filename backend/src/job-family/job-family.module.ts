import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JobFamilyController } from './job-family.controller';
import { JobFamilyService } from './job-family.service';

@Module({
  imports: [AuthModule],
  controllers: [JobFamilyController],
  providers: [JobFamilyService],
  exports: [JobFamilyService],
})
export class JobFamilyModule {}
