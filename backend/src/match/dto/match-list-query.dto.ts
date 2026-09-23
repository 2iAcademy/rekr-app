import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { MAX_INT4 } from '../../common/validation/numeric-bounds';

export class MatchListQueryDto {
  /**
   * Capped as well as floored: `Number.isInteger(1e30)` is true, so `@IsInt()`
   * alone accepts a page whose offset no longer fits what the database takes —
   * and that surfaces as a 500, not as the 400 a bad parameter deserves.
   *
   * `type: Number` is what makes the generated client type this parameter as a
   * number rather than as `Object`, which no caller can satisfy: the list was
   * read without arguments until the screen paginated it, so nothing had
   * exercised the shape before.
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
    description: 'Nombre maximum de matchs par page.',
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
