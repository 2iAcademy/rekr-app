import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { MatchListItemDto } from './dto/match-list-item.dto';
import { MatchListQueryDto } from './dto/match-list-query.dto';
import { MatchService } from './match.service';

@Controller('matches')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles('candidate')
export class MatchController {
  constructor(private readonly service: MatchService) {}

  @Get()
  @ApiOkResponse({ type: MatchListItemDto, isArray: true })
  findMine(@CurrentUser() user: AuthUser, @Query() query: MatchListQueryDto) {
    return this.service.findMine(user, query);
  }
}
