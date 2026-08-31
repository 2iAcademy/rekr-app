import type { BusinessMessages } from '@/lib/feedback/failureMessage';

/**
 * 401 is deliberately absent, as everywhere else: `customFetch` refreshes the
 * session and replays the request, then gives up through
 * `notifySessionExpired`. Mapping it here would talk over that.
 */
export const likeFailureBusiness: BusinessMessages = {
  // The card is already gone from the deck when this fires, so the message says
  // what happened to the offer rather than asking for a gesture to repeat.
  404: 'Cette offre n’est plus disponible.',
};
