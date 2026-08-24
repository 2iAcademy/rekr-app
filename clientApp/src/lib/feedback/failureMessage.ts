import { ApiError } from '@/api/customFetch';

const TECHNICAL = 'Une erreur est survenue. Réessayez dans un instant.';
const UNREACHABLE = 'Connexion au serveur impossible. Vérifiez votre connexion et réessayez.';

const SHARED_BUSINESS: BusinessMessages = {
  400: 'Vérifiez votre email et votre mot de passe (8 caractères minimum).',
  429: 'Trop de tentatives. Patientez une minute avant de réessayer.',
};

export type BusinessMessages = Readonly<Partial<Record<number, string>>>;

export const failureMessage = (cause: unknown, business: BusinessMessages): string => {
  if (!(cause instanceof ApiError)) {
    return UNREACHABLE;
  }

  return business[cause.status] ?? SHARED_BUSINESS[cause.status] ?? TECHNICAL;
};
