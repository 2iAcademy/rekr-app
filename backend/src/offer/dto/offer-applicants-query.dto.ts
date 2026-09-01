import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { MAX_INT4 } from '../../common/validation/numeric-bounds';

/**
 * Plain offset pagination, unlike the feeds.
 *
 * A deck carries no page because answering a card removes it, so an offset
 * would skip over the next one. This list is stable: nothing leaves it when the
 * recruiter reads it, so a page number means what it says.
 */
export class OfferApplicantsQueryDto {
  /**
   * Capped as well as floored: `Number.isInteger(1e18)` is true, so `@IsInt()`
   * alone accepts a page whose offset no longer fits what the database takes —
   * and that surfaces as a 500, not as the 400 a bad parameter deserves.
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
    description: 'Nombre maximum de candidats par page.',
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
