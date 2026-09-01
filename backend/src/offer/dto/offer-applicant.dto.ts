import { ApiProperty } from '@nestjs/swagger';
import {
  Availability,
  ContractType,
  ExperienceLevel,
  RemotePolicy,
} from '../../../generated/prisma/client';

/**
 * One candidate who applied to an offer, as their recruiter reads them.
 *
 * A deliberately narrower shape than `CandidateProfileResponseDto`: the person
 * behind it has shown interest, not agreed to be identified. The surname stays
 * back until a match, and the salary expectations stay private to the
 * candidate — unlike an offer's, which are published.
 *
 * Nullables are `@ApiProperty({ nullable: true })` rather than
 * `@ApiPropertyOptional`, per `CandidateProfileResponseDto`: the key is always
 * present, only its value can be null.
 *
 * Every enum carries `enumName`, which is what makes the generated client reuse
 * the shared `ContractType` / `ExperienceLevel` / … schemas instead of minting a
 * per-DTO copy. Without it two endpoints end up with two incompatible types for
 * the same business enum.
 */
export class OfferApplicantDto {
  /**
   * The only identifier exposed, and the one a like is keyed on:
   * `RecruiterLikesCandidate` points at the user, not at the profile row.
   */
  @ApiProperty({ example: 42 })
  userId!: number;

  @ApiProperty({ example: 'Ada', maxLength: 100 })
  firstName!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'candidates/42/picture/8f3c.webp',
  })
  picture!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Pionnière du calcul.',
  })
  bio!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Lyon' })
  city!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Développeuse back-end',
  })
  desiredJobTitle!: string | null;

  @ApiProperty({
    enum: ContractType,
    enumName: 'ContractType',
    isArray: true,
    example: ['CDI', 'FREELANCE'],
  })
  contractTypes!: ContractType[];

  @ApiProperty({
    enum: ExperienceLevel,
    enumName: 'ExperienceLevel',
    nullable: true,
    example: 'CONFIRME',
  })
  experienceLevel!: ExperienceLevel | null;

  @ApiProperty({
    enum: Availability,
    enumName: 'Availability',
    nullable: true,
    example: 'IMMEDIATE',
  })
  availability!: Availability | null;

  @ApiProperty({
    enum: RemotePolicy,
    enumName: 'RemotePolicy',
    nullable: true,
    example: 'HYBRID',
  })
  remotePolicy!: RemotePolicy | null;

  @ApiProperty({ type: [String], example: ['React', 'TypeScript'] })
  tags!: string[];
}
