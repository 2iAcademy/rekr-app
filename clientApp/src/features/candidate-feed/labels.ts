export const likedOfferCountLabel = (count: number): string =>
  count === 0 ? 'Aucune offre likée' : count === 1 ? '1 offre likée' : `${count} offres likées`;
