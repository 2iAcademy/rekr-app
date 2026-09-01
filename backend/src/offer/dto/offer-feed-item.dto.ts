import { ApiProperty } from '@nestjs/swagger';
import {
  ContractType,
  ExperienceLevel,
  RemotePolicy,
} from '../../../generated/prisma/client';

/**
 * The showcase shape of an offer in the candidate feed.
 *
 * Every nullable field is declared `@ApiProperty({ nullable: true })` rather
 * than `@ApiPropertyOptional`: the key is always present, only its value can be
 * null. The generated client then types it `T | null` instead of
 * `T | null | undefined`.
 */
export class OfferFeedCompanyDto {
  @ApiProperty({ example: 8 })
  id!: number;

  @ApiProperty({ example: 'Acme Corp' })
  name!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'companies/8/logo/acme.webp',
  })
  logo!: string | null;
}

export class OfferFeedItemDto {
  @ApiProperty({ example: 50 })
  id!: number;

  @ApiProperty({ example: 'Développeur Full-Stack' })
  title!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Rejoignez une équipe produit de six personnes.',
  })
  description!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Lyon' })
  city!: string | null;

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

  @ApiProperty({ example: '2026-08-18T10:00:00.000Z', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: () => OfferFeedCompanyDto })
  company!: OfferFeedCompanyDto;

  @ApiProperty({ type: String, isArray: true, example: ['React', 'Node.js'] })
  tags!: string[];
}
