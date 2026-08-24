import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SectorController } from './sector.controller';
import { SectorService } from './sector.service';

@Module({
  imports: [AuthModule],
  controllers: [SectorController],
  providers: [SectorService],
})
export class SectorModule {}
