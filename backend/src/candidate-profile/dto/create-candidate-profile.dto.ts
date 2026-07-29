import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
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
import {
  Availability,
  ContractType,
  ExperienceLevel,
  RemotePolicy,
} from '../../../generated/prisma/client';
import { MAX_SKILLS, MAX_TAG_LABEL_LENGTH } from '../../common/tags/tag-bounds';
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
}
