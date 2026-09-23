import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatchListItemDto } from './match-list-item.dto';

/** Result of either half of a reciprocal like. */
export class LikeResultDto {
  @ApiProperty({ example: true })
  likeCreated!: boolean;

  @ApiProperty({
    description:
      'Whether this request completed the reciprocal pair and created its match.',
    example: false,
  })
  matchCreated!: boolean;

  @ApiPropertyOptional({ type: () => MatchListItemDto })
  match?: MatchListItemDto;
}
