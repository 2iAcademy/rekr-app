import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SectorDto } from './dto/sector.dto';
import { SectorService } from './sector.service';

@Controller('sectors')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SectorController {
  constructor(private readonly service: SectorService) {}

  // Reference data, not recruiter-owned: candidates will filter on it too, so
  // the route is authenticated but not restricted to a user type.
  @Get()
  @ApiOkResponse({ type: [SectorDto] })
  findAll(): Promise<SectorDto[]> {
    return this.service.findAll();
  }
}
