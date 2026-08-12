import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  Availability,
  ContractType,
  ExperienceLevel,
  RemotePolicy,
} from '../../../generated/prisma/client';
import {
  MAX_LANGUAGES,
  MAX_SKILLS,
  MAX_TAG_LABEL_LENGTH,
} from '../../common/tags/tag-bounds';
import { MAX_INT4 } from '../../common/validation/numeric-bounds';
import { NoControlCharacters } from '../../common/validation/no-control-characters';
import { MAX_FREE_TEXT_LENGTH } from '../../common/validation/text-bounds';
import {
  EmptyUrlToNull,
  HTTP_URL_OPTIONS,
  MAX_URL_LENGTH,
} from '../../common/validation/url-bounds';

// Asking for every contract type at once is already the widest legitimate
// search, so the enum size is the natural cap.
const MAX_CONTRACT_TYPES = Object.keys(ContractType).length;

export class CreateCandidateProfileDto {
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_FREE_TEXT_LENGTH)
  bio?: string;

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
  @IsString()
  @MaxLength(255)
  desiredJobTitle?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CONTRACT_TYPES)
  @IsEnum(ContractType, { each: true })
  contractTypes?: ContractType[];

  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  @IsOptional()
  @IsEnum(Availability)
  availability?: Availability;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_INT4)
  availabilityDelayMonths?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  availabilityDate?: Date;

  @IsOptional()
  @IsEnum(RemotePolicy)
  remotePolicy?: RemotePolicy;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_INT4)
  mobilityRadiusKm?: number;

  @IsOptional()
  @IsBoolean()
  mobilityNationwide?: boolean;

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
  @EmptyUrlToNull()
  @IsString()
  @MaxLength(MAX_URL_LENGTH)
  @IsUrl(HTTP_URL_OPTIONS)
  linkedinUrl?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SKILLS)
  @IsString({ each: true })
  @MaxLength(MAX_TAG_LABEL_LENGTH, { each: true })
  @NoControlCharacters({ each: true })
  skills?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_LANGUAGES)
  @IsString({ each: true })
  @MaxLength(MAX_TAG_LABEL_LENGTH, { each: true })
  @NoControlCharacters({ each: true })
  languages?: string[];
}
