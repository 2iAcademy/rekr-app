import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
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
import { OfferService } from './offer.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OfferDetailDto, OfferDto } from './dto/offer-detail.dto';
import { OfferFeedItemDto } from './dto/offer-feed-item.dto';
import { OfferFeedQueryDto } from './dto/offer-feed-query.dto';
import { OfferListItemDto } from './dto/offer-list-item.dto';
import { OfferListQueryDto } from './dto/offer-list-query.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';

@Controller('offers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles('recruiter')
@ApiUnauthorizedResponse({ description: 'Jeton absent ou invalide.' })
@ApiForbiddenResponse({ description: 'Le rôle appelant n’a pas accès.' })
export class OfferController {
  constructor(private readonly service: OfferService) {}

  @Get()
  @ApiOkResponse({ type: OfferListItemDto, isArray: true })
  @ApiNotFoundResponse({
    description: 'Le recruteur appelant n’est rattaché à aucune société.',
  })
  findMine(
    @CurrentUser() user: AuthUser,
    @Query() query: OfferListQueryDto,
  ): Promise<OfferListItemDto[]> {
    return this.service.findMine(user.id, query);
  }

  // Declared before `:id`, which would otherwise swallow `feed` and answer 400
  // on the ParseIntPipe.
  @Get('feed')
  @Roles('candidate')
  @ApiOkResponse({ type: OfferFeedItemDto, isArray: true })
  findFeed(
    @CurrentUser() user: AuthUser,
    @Query() query: OfferFeedQueryDto,
  ): Promise<OfferFeedItemDto[]> {
    return this.service.findFeed(user, query);
  }

  // 404 and not 403 on an offer the caller may not read: telling a stranger
  // « you may not touch this one » already tells them the id exists.
  @Get(':id')
  @Roles('candidate', 'recruiter')
  @ApiOkResponse({ type: OfferDetailDto })
  @ApiNotFoundResponse({
    description:
      'Offre inexistante, ou hors de portée de l’appelant : une offre non publiée n’est lisible que par sa propre société.',
  })
  findOneById(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.findOneById(user, id);
  }

  @Post()
  @ApiCreatedResponse({ type: OfferDto })
  @ApiNotFoundResponse({
    description: 'Le recruteur appelant n’est rattaché à aucune société.',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOfferDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: OfferDto })
  @ApiNotFoundResponse({
    description: 'Offre inexistante, ou appartenant à une autre société.',
  })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOfferDto,
  ) {
    return this.service.update(user.id, id, dto);
  }
}
