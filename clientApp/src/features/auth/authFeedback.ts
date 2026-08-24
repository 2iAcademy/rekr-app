import type { BusinessMessages } from '@/lib/feedback/failureMessage';

export const SIGNUP_SUCCESS = 'Compte créé. Bienvenue sur Rekr !';
export const LOGIN_SUCCESS = 'Vous êtes connecté.';

export const signupBusiness: BusinessMessages = {
  409: 'Un compte existe déjà pour cet email. Connectez-vous ou utilisez une autre adresse.',
};

export const loginBusiness: BusinessMessages = {
  401: 'Email ou mot de passe incorrect. Réessayez ou réinitialisez votre mot de passe.',
  403: 'Ce compte est désactivé. Contactez-nous pour le réactiver.',
};
