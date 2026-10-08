import { ApiProperty } from '@nestjs/swagger';

export class MatchChannelDto {
  @ApiProperty({ example: 'messaging' })
  channelType!: string;

  @ApiProperty({ example: 'match-12' })
  channelId!: string;

  @ApiProperty({
    example: 'Acme Corp',
    description:
      'L’autre partie : la société pour un candidat, le candidat pour un recruteur.',
  })
  counterpartName!: string;

  @ApiProperty({
    example: 4,
    description: 'L’offre du match, pour mener à sa fiche ou à ses candidats.',
  })
  offerId!: number;

  @ApiProperty({
    example: false,
    description: 'Vrai quand l’offre est pourvue ou fermée : lecture seule.',
  })
  frozen!: boolean;
}
