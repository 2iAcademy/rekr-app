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
import { OfferApplicantDto } from './dto/offer-applicant.dto';
import { OfferApplicantsQueryDto } from './dto/offer-applicants-query.dto';
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

  // Literal segment, declared before the `:id` sibling for the same reason as
  // `feed`: read after it, the word would be parsed as an identifier.
  @Get('liked')
  @Roles('candidate')
  @ApiOkResponse({ type: OfferFeedItemDto, isArray: true })
  findLiked(
    @CurrentUser() user: AuthUser,
    @Query() query: OfferApplicantsQueryDto,
  ): Promise<OfferFeedItemDto[]> {
    return this.service.findLiked(user.id, query);
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
  ): Promise<OfferDetailDto> {
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

  /**
   * A candidate shows interest in an offer.
   *
   * No body: the pair (caller, offer) is the whole statement, and neither half
   * comes from the payload.
   */
  @Post(':id/like')
  @Roles('candidate')
  @ApiCreatedResponse({ description: 'Intérêt enregistré.' })
  @ApiNotFoundResponse({ description: 'Offre inexistante ou non publiée.' })
  like(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.service.like(user.id, id);
  }

  @Get(':id/likes')
  @ApiOkResponse({ type: OfferApplicantDto, isArray: true })
  @ApiNotFoundResponse({
    description: 'Offre inexistante, ou appartenant à une autre société.',
  })
  findApplicants(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: OfferApplicantsQueryDto,
  ): Promise<OfferApplicantDto[]> {
    return this.service.findApplicants(user.id, id, query);
  }

  /**
   * The recruiter answers one of their applicants.
   *
   * Nested under the offer rather than sitting on the candidate: a recruiter
   * may only answer someone who came to one of their posts, and the offer is
   * what carries that right.
   */
  @Post(':id/likes/:candidateUserId')
  @ApiCreatedResponse({ description: 'Intérêt enregistré.' })
  @ApiNotFoundResponse({
    description:
      'Offre hors de portée de l’appelant, ou candidat n’ayant pas postulé.',
  })
  likeApplicant(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('candidateUserId', ParseIntPipe) candidateUserId: number,
  ): Promise<void> {
    return this.service.likeApplicant(user.id, id, candidateUserId);
  }
}
