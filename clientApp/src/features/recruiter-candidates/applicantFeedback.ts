import type { BusinessMessages } from '@/lib/feedback/failureMessage';

/**
 * 401 is deliberately absent, as everywhere else: `customFetch` refreshes the
 * session and replays the request, then gives up through
 * `notifySessionExpired`. Mapping it here would talk over that.
 */
export const applicantLikeBusiness: BusinessMessages = {
  // One 404 for two dead ends the recruiter cannot tell apart, and does not
  // need to: the offer left their company, or the candidate withdrew.
  404: 'Ce candidat n’est plus rattaché à cette offre. Rechargez la page.',
};
