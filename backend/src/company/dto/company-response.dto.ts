import { ApiProperty } from '@nestjs/swagger';
import { CompanySize } from '../../../generated/prisma/client';

/**
 * The recruiter behind the company, read from `recruiter_profile`.
 *
 * Nested rather than flattened into the company: these three fields belong to
 * the caller's own row, not to the company, and two recruiters of the same
 * company each get their own. Flattening them would read as company data.
 */
export class CompanyRecruiterDto {
  @ApiProperty({ example: 'Rick', maxLength: 100 })
  firstName!: string;

  @ApiProperty({ example: 'Deckard', maxLength: 100 })
  lastName!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Responsable RH',
    maxLength: 150,
  })
  jobTitle!: string | null;
}

/**
 * The read shape of a company. Nullable fields follow the same rule as
 * `CandidateProfileResponseDto`: the key is always present, its value may be
 * null.
 */
export class CompanyResponseDto {
  @ApiProperty({ example: 8 })
  id!: number;

  @ApiProperty({ example: 'Acme', maxLength: 255 })
  name!: string;

  /**
   * Storage key, not a URL, same as `coverImage` — the client turns it into
   * one.
   */
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

  @ApiProperty({ type: Number, nullable: true, example: 12 })
  sectorId!: number | null;

  @ApiProperty({ type: String, nullable: true, example: 'Une belle boîte.' })
  description!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'https://acme.dev' })
  siteUrl!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'companies/8/cover-image/acme.webp',
  })
  coverImage!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Lyon' })
  city!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '69002' })
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

  /**
   * Benefits only, sorted by label. `company_tag` is a plain pivot on the
   * shared tag dictionary, so the category is filtered on read instead of
   * trusting that only benefits were ever linked.
   */
  @ApiProperty({ type: [String], example: ['Mutuelle', 'Télétravail'] })
  benefits!: string[];

  @ApiProperty({ type: () => CompanyRecruiterDto })
  recruiter!: CompanyRecruiterDto;

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
