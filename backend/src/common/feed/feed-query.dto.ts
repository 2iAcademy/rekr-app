import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
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
  RemotePolicy,
} from '../../../generated/prisma/client';
import { NoControlCharacters } from '../validation/no-control-characters';

export class FeedQueryDto {
  // The deck carries no offset. A card answered leaves it, so the next read is
  // already the rest of the deck; an offset computed over a set the swipe
  // shrinks jumps over a card instead of continuing after it.
  //
  // `type: Number` is explicit because orval otherwise emits `Object` for the
  // generated front-end params (visible today on MatchControllerFindMineParams).
  @ApiPropertyOptional({
    type: Number,
    default: 20,
    description: 'Nombre maximum de cartes renvoyées.',
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({
    enum: ContractType,
    enumName: 'ContractType',
    description: 'Ne garder que les résultats de ce type de contrat.',
  })
  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;

  @ApiPropertyOptional({
    enum: ExperienceLevel,
    enumName: 'ExperienceLevel',
    description: "Ne garder que les résultats de ce niveau d'expérience.",
  })
  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  @ApiPropertyOptional({
    enum: RemotePolicy,
    enumName: 'RemotePolicy',
    description: 'Ne garder que les résultats de ce mode de télétravail.',
  })
  @IsOptional()
  @IsEnum(RemotePolicy)
  remotePolicy?: RemotePolicy;

  @ApiPropertyOptional({
    description: 'Ne garder que les résultats situés dans cette commune.',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @NoControlCharacters()
  city?: string;
}
