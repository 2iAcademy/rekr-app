import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { LikeListItemDto } from './dto/like-list-item.dto';
import { LikeListQueryDto } from './dto/like-list-query.dto';
import { LikeService } from './like.service';

@Controller('likes')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Jeton absent ou invalide.' })
@ApiForbiddenResponse({ description: 'Le rôle appelant n’a pas accès.' })
export class LikeController {
  constructor(private readonly service: LikeService) {}

  // Asymmetric by design: a recruiter only likes a candidate who already liked
  // one of their offers, and that like creates the match at once — so a
  // recruiter's sent list and a candidate's received list are always empty.
  @Get('sent')
  @Roles('candidate')
  @ApiOkResponse({ type: LikeListItemDto, isArray: true })
  findSent(
    @CurrentUser() user: AuthUser,
    @Query() query: LikeListQueryDto,
  ): Promise<LikeListItemDto[]> {
    return this.service.findSent(user, query);
  }

  @Get('received')
  @Roles('recruiter')
  @ApiOkResponse({ type: LikeListItemDto, isArray: true })
  @ApiNotFoundResponse({
    description: 'Le recruteur appelant n’est rattaché à aucune société.',
  })
  findReceived(
    @CurrentUser() user: AuthUser,
    @Query() query: LikeListQueryDto,
  ): Promise<LikeListItemDto[]> {
    return this.service.findReceived(user, query);
  }
}
