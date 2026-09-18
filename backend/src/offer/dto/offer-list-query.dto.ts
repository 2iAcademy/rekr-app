import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { OfferStatus } from '../../../generated/prisma/client';
import { MAX_INT4 } from '../../common/validation/numeric-bounds';

/**
 * `type: Number` is spelled out on both numeric fields: a property declared by
 * its initializer alone carries no `design:type`, so TypeScript emits `Object`
 * and the generated schema referenced an empty `Object` model instead of a
 * number.
 */
export class OfferListQueryDto {
  /**
   * `Number.isInteger(1e18)` is true, so `@IsInt()` alone accepts a page whose
   * offset no longer fits what the database takes: bounding it here rejects
   * the request before it reaches Postgres, where it would surface as a 500.
   */
  @ApiPropertyOptional({
    type: Number,
    default: 1,
    description: 'Numéro de page, à partir de 1.',
    minimum: 1,
    maximum: MAX_INT4,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  page = 1;

  @ApiPropertyOptional({
    type: Number,
    default: 50,
    description: 'Nombre maximum d’offres par page.',
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  /**
   * Absent means every status, draft and closed included: this list is the
   * recruiter's management screen, not the candidate feed.
   */
  @ApiPropertyOptional({
    enum: OfferStatus,
    enumName: 'OfferStatus',
    description: 'Ne renvoie que les offres de ce statut.',
    example: 'open',
  })
  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;
}
