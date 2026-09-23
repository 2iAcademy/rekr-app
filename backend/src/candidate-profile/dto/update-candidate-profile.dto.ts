import { OmitType, PartialType } from '@nestjs/mapped-types';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { MAX_JOB_FAMILIES } from '../../common/tags/tag-bounds';
import { MAX_INT4 } from '../../common/validation/numeric-bounds';
import { CreateCandidateProfileDto } from './create-candidate-profile.dto';

export class UpdateCandidateProfileDto extends PartialType(
  OmitType(CreateCandidateProfileDto, ['jobFamilyIds'] as const),
) {
  /**
   * Redeclared rather than inherited: `PartialType` keeps the creation's
   * `@ArrayMinSize(1)`, which made the empty list unreachable once a trade had
   * been picked. Empty is the state of every account created before job
   * families, and it reopens the feed to every trade — a candidate must be
   * able to come back to it from their profile.
   *
   * Omitted, the trades are left alone; sent, they replace the previous ones
   * in the order given, the first being the primary.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_JOB_FAMILIES)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_INT4, { each: true })
  jobFamilyIds?: number[];
}
