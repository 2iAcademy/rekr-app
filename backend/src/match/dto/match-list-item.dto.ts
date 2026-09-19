import { ApiProperty } from '@nestjs/swagger';

export class MatchOfferDto {
  @ApiProperty({ example: 4 })
  id!: number;

  @ApiProperty({ example: 'Développeur Full-Stack' })
  title!: string;
}

/**
 * The other side of a match. Candidates see the company behind the offer;
 * recruiters see the matched candidate.
 *
 * The discriminator keeps the response role-safe while letting the generated
 * client represent both views through the same endpoint contract.
 */
export class MatchCounterpartDto {
  @ApiProperty({ enum: ['company', 'candidate'], example: 'company' })
  kind!: 'company' | 'candidate';

  @ApiProperty({ example: 8 })
  id!: number;

  @ApiProperty({ example: 'Acme Corp' })
  name!: string;

  @ApiProperty({
    type: String,
    example: 'companies/8/logo/acme.webp',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({
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
