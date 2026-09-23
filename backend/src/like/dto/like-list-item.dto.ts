import { ApiProperty } from '@nestjs/swagger';
import {
  MatchCounterpartDto,
  MatchOfferDto,
} from '../../match/dto/match-list-item.dto';

/**
 * A like still waiting for its other half, as either side reads it.
 *
 * Shares the offer and counterpart shapes with `MatchListItemDto` on purpose:
 * the two lists sit in the same screen, so the generated client describes a row
 * once. There is no `id` — `candidate_likes_offer` is keyed on the pair.
 */
export class LikeListItemDto {
  @ApiProperty({ example: 4 })
  offerId!: number;

  @ApiProperty({
    type: Number,
    description: 'Null sur /likes/sent, où le candidat est l’appelant.',
    example: 7,
    nullable: true,
  })
  candidateUserId!: number | null;

  @ApiProperty({ example: '2026-08-18T10:00:00.000Z', format: 'date-time' })
  likedAt!: Date;

  @ApiProperty({ type: () => MatchOfferDto })
  offer!: MatchOfferDto;

  @ApiProperty({ type: () => MatchCounterpartDto })
  counterpart!: MatchCounterpartDto;
}
