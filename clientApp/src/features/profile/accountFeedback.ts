import type { BusinessMessages } from '@/lib/feedback/failureMessage';

export const PROFILE_UPDATE_SUCCESS = 'Vos informations sont enregistrées.';
export const FILE_REPLACE_SUCCESS = 'Le fichier est enregistré.';
export const FILE_REMOVE_SUCCESS = 'Le fichier est supprimé.';
export const LOGOUT_SUCCESS = 'Vous êtes déconnecté.';

/**
 * Shared by the three tables: a candidate profile and a company are both
 * addressed as « me », so a 404 means the row behind the session is gone —
 * the same dead end whichever entity it was.
 */
const MISSING_RECORD = 'Cette fiche n’existe plus. Rechargez la page avant de réessayer.';

/**
 * 401 is deliberately absent everywhere: `customFetch` refreshes the session and
 * replays the request, and gives up through `notifySessionExpired`. Mapping it
 * here would talk over that.
 */
export const profileUpdateBusiness: BusinessMessages = {
  // The shared 400 is worded for the login form ("email and password"), which
  // says nothing true about a profile form.
  400: 'Certaines informations sont refusées. Vérifiez les champs du formulaire.',
  404: MISSING_RECORD,
};

export const fileReplaceBusiness: BusinessMessages = {
  // The API decides the type by sniffing the magic bytes, so a `.png` that is
  // really a PDF passes the client check and is refused here. Nothing about the
  // file the user picked looks wrong, hence the explicit way out.
  400: 'Ce fichier a été refusé : son contenu ne correspond pas à son format. Réenregistrez-le au bon format, puis réessayez.',
  404: MISSING_RECORD,
  // Above the 10 MB multipart ceiling the body is never read whole, so the
  // per-slot limits the form enforces cannot have produced this one.
  413: 'Ce fichier est trop volumineux pour être envoyé. Choisissez-en un plus léger.',
};

export const fileRemoveBusiness: BusinessMessages = {
  404: MISSING_RECORD,
};
