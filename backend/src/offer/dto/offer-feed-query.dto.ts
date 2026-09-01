import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

/**
 * The deck takes a size, and nothing else.
 *
 * It used to extend `FeedQueryDto` and inherit its four filters. They are gone
 * on purpose: the contract types and the remote policy now come from the
 * candidate's own profile, and leaving the query parameters in place would
 * advertise a second way to say the same thing — with a different meaning, since
 * a query filter drops the offers whose column is null where a preference keeps
 * them.
 *
 * No offset either: a card answered leaves the deck, so the next read is
 * already the rest of it. An offset computed over a set the swipe shrinks would
 * jump over a card instead of continuing after it.
 */
export class OfferFeedQueryDto {
  @ApiPropertyOptional({
    type: Number,
    default: 20,
    description: 'Nombre maximum de cartes renvoyées.',
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
