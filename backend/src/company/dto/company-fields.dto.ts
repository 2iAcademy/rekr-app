import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CompanySize } from '../../../generated/prisma/client';
import { MAX_INT4 } from '../../common/validation/numeric-bounds';
import { MAX_FREE_TEXT_LENGTH } from '../../common/validation/text-bounds';
import {
  EmptyUrlToNull,
  HTTP_URL_OPTIONS,
  MAX_URL_LENGTH,
} from '../../common/validation/url-bounds';

export class CompanyFieldsDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsEnum(CompanySize)
  size?: CompanySize;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  sectorId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_FREE_TEXT_LENGTH)
  description?: string;

  @IsOptional()
  @EmptyUrlToNull()
  @IsString()
  @MaxLength(MAX_URL_LENGTH)
  @IsUrl(HTTP_URL_OPTIONS)
  siteUrl?: string | null;

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
}
