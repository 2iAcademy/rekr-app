import { ApiProperty } from '@nestjs/swagger';
import {
  Availability,
  ContractType,
  ExperienceLevel,
  RemotePolicy,
} from '../../../generated/prisma/client';

/**
 * The read shape of a candidate profile.
 *
 * Every nullable field is declared `@ApiProperty({ nullable: true })` rather
 * than `@ApiPropertyOptional`: the key is always present, only its value can be
 * null. The generated client then types it `T | null` instead of
 * `T | null | undefined`, which is what the edit form binds to — an absent key
 * would turn a controlled input into an uncontrolled one.
 */
export class CandidateProfileResponseDto {
  @ApiProperty({ example: 7 })
  id!: number;

  @ApiProperty({ example: 42 })
  userId!: number;

  @ApiProperty({ example: 'Ada', maxLength: 100 })
  firstName!: string;

  @ApiProperty({ example: 'Lovelace', maxLength: 100 })
  lastName!: string;

  /**
   * Storage key, not a URL, same as `cvUrl` below — the client turns it into
   * one. `cv_url` is a column name inherited from the schema; no URL has ever
   * been written there.
   */
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

  @ApiProperty({ type: String, nullable: true, example: '69001' })
  postalCode!: string | null;

  /**
   * `Decimal(10, 7)`, rendered as a string the way any JSON encoder renders an
   * arbitrary-precision number. Parsing it as a float is the client's call, not
   * a rounding this API imposes on the coordinate matching relies on.
   */
  @ApiProperty({ type: String, nullable: true, example: '45.758' })
  latitude!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '4.835' })
  longitude!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Développeuse Front React',
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
    example: 'WITHIN_DELAY',
  })
  availability!: Availability | null;

  @ApiProperty({ type: Number, nullable: true, example: 3 })
  availabilityDelayMonths!: number | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-09-01T00:00:00.000Z',
  })
  availabilityDate!: Date | null;

  @ApiProperty({
    enum: RemotePolicy,
    enumName: 'RemotePolicy',
    nullable: true,
    example: 'HYBRID',
  })
  remotePolicy!: RemotePolicy | null;

  @ApiProperty({ type: Number, nullable: true, example: 30 })
  mobilityRadiusKm!: number | null;

  @ApiProperty({ type: Boolean, nullable: true, example: false })
  mobilityNationwide!: boolean | null;

  @ApiProperty({ type: Number, nullable: true, example: 45000 })
  salaryMin!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 60000 })
  salaryMax!: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://linkedin.com/in/ada',
  })
  linkedinUrl!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'candidates/42/cv/8f3c.pdf',
  })
  cvUrl!: string | null;

  /**
   * Tags split by category and sorted by label, rather than one flat list: the
   * account screen renders two distinct groups, and « Anglais » is a legitimate
   * label in both — the category is the only thing telling them apart.
   */
  @ApiProperty({ type: [String], example: ['React', 'TypeScript'] })
  skills!: string[];

  @ApiProperty({ type: [String], example: ['Anglais', 'Espagnol'] })
  languages!: string[];

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-08-01T09:12:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-08-20T14:03:00.000Z',
  })
  updatedAt!: Date;
}
