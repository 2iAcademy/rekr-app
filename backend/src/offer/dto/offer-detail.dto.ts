import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CompanySize,
  ContractType,
  ExperienceLevel,
  OfferStatus,
  RemotePolicy,
  TagCategory,
} from '../../../generated/prisma/client';

/**
 * The company projection carried by an offer: the six columns
 * `OfferService.findOneById` selects, no more. Not `CompanyResponseDto`, which
 * is the recruiter's own read of their company and exposes columns a candidate
 * has no business seeing.
 */
export class OfferDetailCompanyDto {
  @ApiProperty({ example: 8 })
  id!: number;

  @ApiProperty({ example: 'Acme', maxLength: 255 })
  name!: string;

  /** Storage key, not a URL — the client turns it into one. */
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'companies/8/logo/acme.webp',
  })
  logo!: string | null;

  @ApiProperty({
    enum: CompanySize,
    enumName: 'CompanySize',
    nullable: true,
    example: 'PME',
  })
  size!: CompanySize | null;

  @ApiProperty({ type: String, nullable: true, example: 'Une belle boîte.' })
  description!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Lyon' })
  city!: string | null;
}

/**
 * A tag as the detail screen reads it: what it says and which list it belongs
 * to. Its own key is left out — no screen addresses a tag by id, and shipping
 * one hands a caller another id space to walk.
 */
export class OfferDetailTagDto {
  @ApiProperty({ example: 'React', maxLength: 100 })
  label!: string;

  @ApiProperty({
    enum: TagCategory,
    enumName: 'TagCategory',
    example: 'skill',
  })
  category!: TagCategory;
}

/**
 * The bare `offer` row, without relations: what `POST /offers` and
 * `PATCH /offers/:id` echo back.
 */
export class OfferDto {
  @ApiProperty({ example: 50 })
  id!: number;

  @ApiProperty({ example: 8 })
  companyId!: number;

  /** Null once the recruiter who wrote the offer is deleted (`SetNull`). */
  @ApiProperty({ type: Number, nullable: true, example: 7 })
  createdById!: number | null;

  @ApiProperty({ example: 'Développeur Front', maxLength: 255 })
  title!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Belle mission.' })
  description!: string | null;

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

  @ApiProperty({ enum: OfferStatus, enumName: 'OfferStatus', example: 'open' })
  status!: OfferStatus;

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

/**
 * The read shape of `GET /offers/:id`: an explicit projection, not the `offer`
 * row. Deliberately not extending `OfferDto` — that class describes what the
 * write endpoints echo back to the recruiter who owns the offer, and inheriting
 * it here is how the internal columns reached a candidate in the first place.
 */
export class OfferDetailDto {
  @ApiProperty({ example: 50 })
  id!: number;

  @ApiProperty({ example: 'Développeur Front', maxLength: 255 })
  title!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Belle mission.' })
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

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-08-01T09:12:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({ type: () => OfferDetailCompanyDto })
  company!: OfferDetailCompanyDto;

  @ApiProperty({ type: () => OfferDetailTagDto, isArray: true })
  tags!: OfferDetailTagDto[];

  /**
   * Served only to a recruiter of the company carrying the offer: the postcode
   * places the office and belongs to the management screen. Absent from the
   * answer given to anyone else — not null, absent.
   */
  @ApiPropertyOptional({ type: String, nullable: true, example: '69001' })
  postalCode?: string | null;

  /**
   * Served only to the company carrying the offer. A candidate reaches an offer
   * only while it is published, so the value would be a constant for them —
   * and how a company runs its hiring is not theirs to read.
   */
  @ApiPropertyOptional({
    enum: OfferStatus,
    enumName: 'OfferStatus',
    example: 'open',
  })
  status?: OfferStatus;
}
