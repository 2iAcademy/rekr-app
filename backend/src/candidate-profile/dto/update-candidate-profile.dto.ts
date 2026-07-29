import { PartialType } from '@nestjs/mapped-types';
import { CreateCandidateProfileDto } from './create-candidate-profile.dto';

export class UpdateCandidateProfileDto extends PartialType(
  CreateCandidateProfileDto,
) {}
