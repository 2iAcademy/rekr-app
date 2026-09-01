import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ContractType,
  ExperienceLevel,
  OfferStatus,
  RemotePolicy,
} from '../../../generated/prisma/client';
import {
  MAX_BENEFITS,
  MAX_SKILLS,
  MAX_TAG_LABEL_LENGTH,
} from '../../common/tags/tag-bounds';
import { MAX_INT4 } from '../../common/validation/numeric-bounds';
import { NoControlCharacters } from '../../common/validation/no-control-characters';
import { MAX_FREE_TEXT_LENGTH } from '../../common/validation/text-bounds';

export class CreateOfferDto {
  @ApiProperty({ example: 'Développeur Front', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({
    example: 'Belle mission.',
    maxLength: MAX_FREE_TEXT_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_FREE_TEXT_LENGTH)
  description?: string;

  @ApiPropertyOptional({ example: 'Lyon', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: '69001', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  postalCode?: string;

  // No `latitude` / `longitude` here: the pair (city, postal code) is the only
  // location a client sends, and the coordinates are derived from it server-side
  // by `CityService.assertKnown`. Accepting them would let a payload display one
  // commune and be matched at another's coordinates.

  @ApiPropertyOptional({
    enum: ContractType,
    enumName: 'ContractType',
    example: 'CDI',
  })
  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;

  @ApiPropertyOptional({
    enum: ExperienceLevel,
    enumName: 'ExperienceLevel',
    example: 'CONFIRME',
  })
  @IsOptional()
  @IsEnum(ExperienceLevel)
  minExperienceLevel?: ExperienceLevel;

  @ApiPropertyOptional({
    enum: RemotePolicy,
    enumName: 'RemotePolicy',
    example: 'HYBRID',
  })
  @IsOptional()
  @IsEnum(RemotePolicy)
  remotePolicy?: RemotePolicy;

  /**
   * Nullable, and declared so here rather than overridden in `UpdateOfferDto`,
   * where clearing a stored range is the operation that actually needs it.
   *
   * Two reasons. `UpdateOfferDto` is a `PartialType` of this class, so
   * re-declaring the field there would not replace the inherited `@IsInt()`
   * — class-validator merges the parent's constraints with the child's, and
   * only drops the ones the child redeclares by the same type. Making a single
   * field nullable downstream therefore means restating its whole constraint
   * set and trusting that merge rule to keep holding.
   *
   * And nothing is loosened at creation: the column defaults to NULL, so an
   * omitted `salaryMin` already writes exactly the row an explicit `null`
   * writes. Both spellings mean « no salary range », which is the same thing
   * they mean on the patch.
   *
   * `@IsOptional()` is what lets the value through: it is a conditional
   * validation that skips the property on `null` as well as on `undefined`, so
   * the bounds below still apply to every figure actually sent.
   */
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 45000,
    minimum: 0,
    maximum: MAX_INT4,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_INT4)
  salaryMin?: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 60000,
    minimum: 0,
    maximum: MAX_INT4,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_INT4)
  salaryMax?: number | null;

  /** Omitted means `draft`, the column default. */
  @ApiPropertyOptional({
    enum: OfferStatus,
    enumName: 'OfferStatus',
    default: 'draft',
    example: 'open',
  })
  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;

  @ApiPropertyOptional({
    type: [String],
    example: ['React', 'TypeScript'],
    maxItems: MAX_SKILLS,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SKILLS)
  @IsString({ each: true })
  @MaxLength(MAX_TAG_LABEL_LENGTH, { each: true })
  @NoControlCharacters({ each: true })
  skills?: string[];

  /**
   * Carried by the offer rather than by the company: two posts of the same
   * employer rarely come with the same perks, and the candidate reads them on
   * the offer they are about to like.
   *
   * Shares the `offer_tag` pivot with `skills`, told apart by the category of
   * the tag — hence the paired, category-scoped writes in `OfferService`.
   */
  @ApiPropertyOptional({
    type: [String],
    example: ['Mutuelle', 'Tickets restaurant'],
    maxItems: MAX_BENEFITS,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_BENEFITS)
  @IsString({ each: true })
  @MaxLength(MAX_TAG_LABEL_LENGTH, { each: true })
  @NoControlCharacters({ each: true })
  benefits?: string[];
}
