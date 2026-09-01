import { ApiProperty } from '@nestjs/swagger';
import {
  ContractType,
  ExperienceLevel,
  OfferStatus,
  RemotePolicy,
} from '../../../generated/prisma/client';

/**
 * The row shape of the recruiter's management list. Deliberately narrower than
 * `OfferDetailDto`: the description, the coordinates, the company and the
 * skills belong to the detail view, and shipping them on every row would send
 * a page of free text to draw a table.
 *
 * Nullable fields keep their key and carry `null`, as elsewhere in this API.
 */
export class OfferListItemDto {
  @ApiProperty({ example: 50 })
  id!: number;

  @ApiProperty({ example: 'Développeur Front', maxLength: 255 })
  title!: string;

  @ApiProperty({ enum: OfferStatus, enumName: 'OfferStatus', example: 'open' })
  status!: OfferStatus;

  @ApiProperty({ type: String, nullable: true, example: 'Lyon' })
  city!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '69001' })
  postalCode!: string | null;

  @ApiProperty({
    enum: ContractType,
    enumName: 'ContractType',
    nullable: true,
    example: 'CDI',
  })
  contractType!: ContractType | null;

  @ApiProperty({
    enum: ExperienceLevel,
    enumName: 'ExperienceLevel',
    nullable: true,
    example: 'CONFIRME',
  })
  minExperienceLevel!: ExperienceLevel | null;

  @ApiProperty({
    enum: RemotePolicy,
    enumName: 'RemotePolicy',
    nullable: true,
    example: 'HYBRID',
  })
  remotePolicy!: RemotePolicy | null;

  @ApiProperty({ type: Number, nullable: true, example: 45000 })
  salaryMin!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 60000 })
  salaryMax!: number | null;

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

  /** How many candidates have shown interest in this offer. */
  @ApiProperty({ example: 3, minimum: 0 })
  applicantCount!: number;
}
