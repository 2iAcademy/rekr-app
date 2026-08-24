import type { EmptyReason } from '@/features/recruiter-feed/deck';

const thousands = (amount: number): number => Math.round(amount / 1000);

export const offerSalaryLabel = (min: number | null, max: number | null): string => {
  if (min !== null && max !== null) {
    return `${thousands(min)} - ${thousands(max)} k€`;
  }

  if (min !== null) {
    return `À partir de ${thousands(min)} k€`;
  }

  if (max !== null) {
    return `Jusqu'à ${thousands(max)} k€`;
  }

  return 'Salaire non communiqué';
};

export const offerDeckTitle = (reason: EmptyReason): string =>
  reason === 'no-match' ? 'Aucune offre ne passe vos filtres' : 'Tu as tout vu';

export const likedOfferCountLabel = (count: number): string =>
  count === 0 ? 'Aucune offre likée' : count === 1 ? '1 offre likée' : `${count} offres likées`;
