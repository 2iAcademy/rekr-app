import type { OfferApplicantDto } from '@/api/generated';

/**
 * One complete applicant, for the specs of this feature to build on.
 *
 * A test needs every field populated before it can override the one it is
 * about, and both `ApplicantRow` and `CandidateDetailPage` need the same
 * baseline — hence a shared fixture rather than a copy in each file.
 */
export const anApplicant: OfferApplicantDto = {
  userId: 1,
  firstName: 'Camille',
  picture: null,
  bio: "Sept ans sur des API de paiement, dont trois à porter la migration d'un monolithe vers des services découpés.",
  city: 'Lyon',
  desiredJobTitle: 'Développeuse back-end',
  contractTypes: ['CDI'],
  experienceLevel: 'CONFIRME',
  availability: 'IMMEDIATE',
  remotePolicy: 'HYBRID',
  tags: ['Symfony', 'PostgreSQL', 'Docker'],
};
