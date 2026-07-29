import { Body, Controller, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CandidateProfileService } from './candidate-profile.service';
import { CreateCandidateProfileDto } from './dto/create-candidate-profile.dto';
import { UpdateCandidateProfileDto } from './dto/update-candidate-profile.dto';

@Controller('candidate-profiles')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles('candidate')
export class CandidateProfileController {
  constructor(private readonly service: CandidateProfileService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCandidateProfileDto,
  ) {
    return this.service.create(user.id, dto);
  }

  @Patch('me')
  update(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCandidateProfileDto,
  ) {
    return this.service.update(user.id, dto);
  }
}
