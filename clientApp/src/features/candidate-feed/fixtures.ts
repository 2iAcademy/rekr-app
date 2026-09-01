import type { OfferFeedItemDto } from '@/api/generated';

/**
 * One complete offer of the deck, for the specs of this feature to build on.
 *
 * A test needs every field populated before it can override the one it is
 * about, and the card, the page and the route all need the same baseline. It
 * replaces the demo deck the screen carried while no endpoint served it.
 */
export const anOffer: OfferFeedItemDto = {
  id: 101,
  title: 'Développeur Frontend React',
  description: 'Construire les écrans du produit avec une équipe de six personnes.',
  city: 'Lyon',
  contractType: 'CDI',
  minExperienceLevel: 'CONFIRME',
  remotePolicy: 'HYBRID',
  salaryMin: 45000,
  salaryMax: 55000,
  createdAt: '2026-02-01T00:00:00.000Z',
  company: { id: 7, name: 'Studio Lumen', logo: null },
  tags: ['React', 'TypeScript'],
};

export const anotherOffer: OfferFeedItemDto = {
  ...anOffer,
  id: 102,
  title: 'Data Analyst',
  company: { id: 8, name: 'Orbit', logo: null },
  tags: ['SQL', 'Python'],
};
