import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MatchOfferDto {
  @ApiProperty({ example: 4 })
  id!: number;

  @ApiProperty({ example: 'Développeur Full-Stack' })
  title!: string;
}

export class MatchCounterpartDto {
  @ApiProperty({ enum: ['company', 'candidate'], example: 'company' })
  kind!: 'company' | 'candidate';

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

  @ApiPropertyOptional({ type: () => MatchCounterpartDto, nullable: true })
  counterpart!: MatchCounterpartDto | null;
}
