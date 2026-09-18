import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MatchOfferDto {
  @ApiProperty({ example: 4 })
  id!: number;

  @ApiProperty({ example: 'Développeur Full-Stack' })
  title!: string;
}

/**
 * The other side of a match, seen by the candidate whose list it is: always the
 * company behind the offer.
 *
 * `kind` survives as a single-valued discriminator rather than being dropped:
 * the reciprocal view — a recruiter reading who applied to one of their offers —
 * carries a candidate, and it will land on its own route with its own shape.
 * Keeping the tag means the client can branch on it the day a second shape
 * exists, without the field having to be reintroduced everywhere.
 */
export class MatchCounterpartDto {
  @ApiProperty({ enum: ['company'], example: 'company' })
  kind!: 'company';

  @ApiProperty({ example: 8 })
  id!: number;

  @ApiProperty({ example: 'Acme Corp' })
  name!: string;

  @ApiPropertyOptional({
    type: String,
    example: 'companies/8/logo/acme.webp',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Développeur Full-Stack',
    nullable: true,
  })
  headline!: string | null;
}

export class MatchListItemDto {
  @ApiProperty({ example: 11 })
  id!: number;

  @ApiProperty({ example: '2026-08-18T10:00:00.000Z', format: 'date-time' })
  matchedAt!: Date;

  @ApiProperty({ type: () => MatchOfferDto })
  offer!: MatchOfferDto;

  // Never absent: the list is scoped to offers that are still open, and an
  // offer always belongs to a company.
  @ApiProperty({ type: () => MatchCounterpartDto })
  counterpart!: MatchCounterpartDto;
}
