/** The conversation of a match, which every match row and « Écrire un message » open. */
export const conversationPath = (matchId: number) => `/matches/${matchId}/conversation`;

/**
 * There is no standalone candidate screen: the applicants of the offer are
 * where a recruiter answers them.
 */
export const applicantsPath = (offerId: number) => `/recruteur/offres/${offerId}/candidats`;
