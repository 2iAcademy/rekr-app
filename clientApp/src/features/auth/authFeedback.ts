import type { BusinessMessages } from '@/lib/feedback/failureMessage';

export const PASSWORD_MIN_LENGTH = 8;

export const SIGNUP_SUCCESS = 'Compte créé. Bienvenue sur Rekr !';
export const LOGIN_SUCCESS = 'Vous êtes connecté.';
export const PASSWORD_RESET_SUCCESS =
  'Mot de passe réinitialisé. Connectez-vous avec votre nouveau mot de passe.';

export const signupBusiness: BusinessMessages = {
  409: 'Un compte existe déjà pour cet email. Connectez-vous ou utilisez une autre adresse.',
};

export const loginBusiness: BusinessMessages = {
  401: 'Email ou mot de passe incorrect. Réessayez ou réinitialisez votre mot de passe.',
  403: 'Ce compte est désactivé. Contactez-nous pour le réactiver.',
};

/**
 * Wording the request screen is allowed to surface. The 400 is a rejected
 * address format, so it speaks of the format and of nothing else: the server
 * answers 204 whether the address exists or not, and any message hinting at an
 * account would hand back the enumeration the endpoint was built to close.
 */
export const passwordForgotBusiness: BusinessMessages = {
  400: "Cette adresse email n'est pas valide. Vérifiez votre saisie.",
  429: 'Trop de demandes. Patientez une minute avant de réessayer.',
};

/**
 * The 400 the reset endpoint returns is the verdict on the link, and the screen
 * words it itself; what is left here is the throttle, whose shared wording
 * speaks of sign-in attempts rather than of a password being set.
 */
export const passwordResetBusiness: BusinessMessages = {
  429: 'Trop de tentatives. Patientez une minute avant de réessayer.',
};
