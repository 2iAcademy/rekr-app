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
import { MAX_SKILLS, MAX_TAG_LABEL_LENGTH } from '../../common/tags/tag-bounds';
import { MAX_INT4 } from '../../common/validation/numeric-bounds';
import { NoControlCharacters } from '../../common/validation/no-control-characters';
import { MAX_FREE_TEXT_LENGTH } from '../../common/validation/text-bounds';

export class CreateOfferDto {
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_FREE_TEXT_LENGTH)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  postalCode?: string;

  // No `latitude` / `longitude` here: the pair (city, postal code) is the only
  // location a client sends, and the coordinates are derived from it server-side
  // by `CityService.assertKnown`. Accepting them would let a payload display one
  // commune and be matched at another's coordinates.

  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;

  @IsOptional()
  @IsEnum(ExperienceLevel)
  minExperienceLevel?: ExperienceLevel;

  @IsOptional()
  @IsEnum(RemotePolicy)
  remotePolicy?: RemotePolicy;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_INT4)
  salaryMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_INT4)
  salaryMax?: number;

  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SKILLS)
  @IsString({ each: true })
  @MaxLength(MAX_TAG_LABEL_LENGTH, { each: true })
  @NoControlCharacters({ each: true })
  skills?: string[];
}
