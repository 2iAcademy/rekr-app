import { ApiProperty } from '@nestjs/swagger';
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

export class OfferDetailTagDto {
  @ApiProperty({ example: 12 })
  id!: number;

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
 * A row of the `offer_tag` pivot, returned as it is stored rather than
 * flattened to a list of labels: the detail page reads `offerTags[].tag`, and
 * reshaping it here would break it.
 */
export class OfferDetailTagLinkDto {
  @ApiProperty({ example: 50 })
  offerId!: number;

  @ApiProperty({ example: 12 })
  tagId!: number;

  @ApiProperty({ type: () => OfferDetailTagDto })
  tag!: OfferDetailTagDto;
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
 * The read shape of `GET /offers/:id`, documented as it already is: the whole
 * `offer` row plus the two relations the service includes. The candidate detail
 * page depends on that shape — this DTO describes it, it does not redefine it.
 */
export class OfferDetailDto extends OfferDto {
  @ApiProperty({ type: () => OfferDetailCompanyDto })
  company!: OfferDetailCompanyDto;

  @ApiProperty({ type: () => OfferDetailTagLinkDto, isArray: true })
  offerTags!: OfferDetailTagLinkDto[];
}
