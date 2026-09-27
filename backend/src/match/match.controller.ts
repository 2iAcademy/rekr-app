import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
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
@Roles('candidate', 'recruiter')
@ApiUnauthorizedResponse({ description: 'Jeton absent ou invalide.' })
@ApiForbiddenResponse({ description: 'Le rôle appelant n’a pas accès.' })
export class MatchController {
  constructor(private readonly service: MatchService) {}

  @Get()
  @ApiOkResponse({ type: MatchListItemDto, isArray: true })
  findMine(@CurrentUser() user: AuthUser, @Query() query: MatchListQueryDto) {
    return this.service.findMine(user, query);
  }

  // Both roles, one route: a match is a mutual commitment, so either party
  // ends it, and the teardown is identical whoever asks.
  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Match supprimé.' })
  @ApiNotFoundResponse({
    // Deliberately conflated with « not yours »: telling a stranger that the
    // id exists is the whole of what an enumeration needs.
    description: 'Match inexistant, ou hors du périmètre de l’appelant.',
  })
  unmatch(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.service.unmatch(user, id);
  }
}
