import { FeedQueryDto } from '../../common/feed/feed-query.dto';

/**
 * Named subclass rather than `FeedQueryDto` used directly: the offers feed and
 * the candidates feed take the same parameters today, and a shared Swagger
 * schema would make every later divergence a breaking rename on the generated
 * client.
 */
export class OfferFeedQueryDto extends FeedQueryDto {}
