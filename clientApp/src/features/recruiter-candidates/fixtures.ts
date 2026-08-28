import type { FeedCandidate } from './types';

/**
 * One complete candidate, for the specs of this feature to build on.
 *
 * A test needs every field of `FeedCandidate` populated before it can override
 * the one it is about, and both `labels` and `CandidateDetailPage` need the same
 * baseline — hence a shared fixture rather than a copy in each file. It replaces
 * the demo deck the retired swipe feed carried.
 *
 * The LinkedIn slug is prefixed `exemple-` on purpose: a plausible
 * `in/firstname-lastname` would point at a real stranger's profile. `cvUrl`
 * holds a storage key, the shape the API stores, not a ready-made URL.
 */
export const aCandidate: FeedCandidate = {
  id: 1,
  firstName: 'Camille',
  lastName: 'Moreau',
  age: 29,
  city: 'Lyon',
  avatarUrl: null,
  desiredJobTitle: 'Développeuse back-end',
  experienceLevel: 'CONFIRME',
  contractTypes: ['CDI'],
  availability: 'IMMEDIATE',
  availabilityDelayMonths: null,
  availabilityDate: null,
  remotePolicy: 'HYBRID',
  mobilityRadiusKm: 30,
  mobilityNationwide: false,
  salaryMin: 42000,
  salaryMax: 48000,
  skills: ['Symfony', 'PostgreSQL', 'Docker'],
  languages: ['Français', 'Anglais'],
  bio: "Sept ans sur des API de paiement, dont trois à porter la migration d'un monolithe vers des services découpés. Je cherche une équipe où la revue de code est un vrai moment d'échange.",
  linkedinUrl: 'https://www.linkedin.com/in/exemple-camille-moreau',
  portfolioUrl: null,
  cvUrl: 'candidates/1/cv/3f1c9a52-7b4e-4d18-9f60-2a5c8e10b7d4.pdf',
};
