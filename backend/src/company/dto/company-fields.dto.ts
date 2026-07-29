import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CompanySize } from '../../../generated/prisma/client';
import {
  MAX_BENEFITS,
  MAX_TAG_LABEL_LENGTH,
} from '../../common/tags/tag-bounds';
import {
  MAX_INT4,
  MAX_LATITUDE,
  MAX_LONGITUDE,
  MIN_LATITUDE,
  MIN_LONGITUDE,
} from '../../common/validation/numeric-bounds';
import { NoControlCharacters } from '../../common/validation/no-control-characters';
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

  @IsOptional()
  @IsNumber()
  @Min(MIN_LATITUDE)
  @Max(MAX_LATITUDE)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(MIN_LONGITUDE)
  @Max(MAX_LONGITUDE)
  longitude?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_BENEFITS)
  @IsString({ each: true })
  @MaxLength(MAX_TAG_LABEL_LENGTH, { each: true })
  @NoControlCharacters({ each: true })
  benefits?: string[];
}
