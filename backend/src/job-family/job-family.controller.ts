import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JobFamilyDto } from './dto/job-family.dto';
import { JobFamilyService } from './job-family.service';

@Controller('job-families')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JobFamilyController {
  constructor(private readonly service: JobFamilyService) {}

  // Same shape as `sectors`: reference data both sides read, so the route is
  // authenticated without being restricted to a user type — the recruiter
  // picks one for an offer, the candidate picks up to three for their feed.
  @Get()
  @ApiOkResponse({ type: [JobFamilyDto] })
  findAll(): Promise<JobFamilyDto[]> {
    return this.service.findAll();
  }
}
