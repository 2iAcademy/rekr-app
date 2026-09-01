import { describe, it, expect } from 'vitest';
import { ApiError } from '@/api/customFetch';
import { failureMessage } from '@/lib/feedback/failureMessage';
import {
  FILE_REMOVE_SUCCESS,
  FILE_REPLACE_SUCCESS,
  LOGOUT_SUCCESS,
  PROFILE_UPDATE_SUCCESS,
  fileRemoveBusiness,
  fileReplaceBusiness,
  profileUpdateBusiness,
} from './accountFeedback';

const TECHNICAL = 'Une erreur est survenue. Réessayez dans un instant.';
const UNREACHABLE = 'Connexion au serveur impossible. Vérifiez votre connexion et réessayez.';
const TOO_MANY_ATTEMPTS = 'Trop de tentatives. Patientez une minute avant de réessayer.';
const SHARED_INVALID_INPUT = 'Vérifiez votre email et votre mot de passe (8 caractères minimum).';

const ALL_TABLES = [profileUpdateBusiness, fileReplaceBusiness, fileRemoveBusiness];

const apiError = (status: number, data: unknown = { statusCode: status }) =>
  new ApiError({ status, statusText: '', url: '/api/candidate-profiles/me', data });

describe('libellés de succès du compte', () => {
  it('confirme chaque action de l’écran compte', () => {
    expect(PROFILE_UPDATE_SUCCESS).toBe('Vos informations sont enregistrées.');
    expect(FILE_REPLACE_SUCCESS).toBe('Le fichier est enregistré.');
    expect(FILE_REMOVE_SUCCESS).toBe('Le fichier est supprimé.');
    expect(LOGOUT_SUCCESS).toBe('Vous êtes déconnecté.');
  });

  it('distingue le remplacement de la suppression', () => {
    expect(FILE_REPLACE_SUCCESS).not.toBe(FILE_REMOVE_SUCCESS);
  });
});

describe('accountFeedback', () => {
  it('annonce une fiche disparue sur un 404, pour les trois opérations', () => {
    const cause = apiError(404, {
      statusCode: 404,
      message: 'Candidate profile not found.',
      error: 'Not Found',
    });

    for (const business of ALL_TABLES) {
      expect(failureMessage(cause, business)).toBe(
        'Cette fiche n’existe plus. Rechargez la page avant de réessayer.',
      );
    }
  });

  it('annonce un fichier trop lourd sur le 413 du serveur', () => {
    const cause = apiError(413, {
      statusCode: 413,
      message: 'File too large',
      error: 'Payload Too Large',
    });

    expect(failureMessage(cause, fileReplaceBusiness)).toBe(
      'Ce fichier est trop volumineux pour être envoyé. Choisissez-en un plus léger.',
    );
  });

  it('explique un contenu de fichier refusé sur un 400', () => {
    const cause = apiError(400, {
      statusCode: 400,
      message: 'A picture must be one of: jpg, png, webp.',
      error: 'Bad Request',
    });

    expect(failureMessage(cause, fileReplaceBusiness)).toBe(
      'Ce fichier a été refusé : son contenu ne correspond pas à son format. Réenregistrez-le au bon format, puis réessayez.',
    );
  });

  it('parle du formulaire, jamais du mot de passe, sur un 400 de mise à jour', () => {
    const message = failureMessage(apiError(400), profileUpdateBusiness);

    expect(message).toBe(
      'Certaines informations sont refusées. Vérifiez les champs du formulaire.',
    );
    expect(message).not.toBe(SHARED_INVALID_INPUT);
    expect(message).not.toContain('mot de passe');
  });

  it('ne réserve pas le 413 aux opérations qui n’envoient pas de fichier', () => {
    expect(failureMessage(apiError(413), profileUpdateBusiness)).toBe(TECHNICAL);
    expect(failureMessage(apiError(413), fileRemoveBusiness)).toBe(TECHNICAL);
  });

  it('laisse le 429 au message partagé', () => {
    for (const business of ALL_TABLES) {
      expect(failureMessage(apiError(429), business)).toBe(TOO_MANY_ATTEMPTS);
    }
  });

  it('reste générique sur une panne serveur', () => {
    for (const business of ALL_TABLES) {
      expect(failureMessage(apiError(500), business)).toBe(TECHNICAL);
      expect(failureMessage(apiError(503), business)).toBe(TECHNICAL);
    }
  });

  it('ne mappe pas le 401, dont la session expirée est déjà gérée en amont', () => {
    for (const business of ALL_TABLES) {
      expect(failureMessage(apiError(401), business)).toBe(TECHNICAL);
    }
  });

  it('signale un problème de connexion quand aucune réponse HTTP n’est parvenue', () => {
    expect(failureMessage(new TypeError('Failed to fetch'), fileReplaceBusiness)).toBe(UNREACHABLE);
  });

  it('ne laisse jamais fuiter le message technique du serveur', () => {
    const backendStrings = [
      'File too large',
      'Payload Too Large',
      'Bad Request',
      'Not Found',
      'Internal server error',
      'ThrottlerException',
      'A picture must be one of: jpg, png, webp.',
      'A cv may not exceed 5.0 MB.',
      'Candidate profile not found.',
      'Company not found.',
      'A file is required, under the "file" field.',
    ];

    for (const status of [400, 401, 403, 404, 409, 413, 429, 500, 503, 418]) {
      for (const business of ALL_TABLES) {
        const message = failureMessage(apiError(status), business);

        for (const leaked of backendStrings) {
          expect(message).not.toContain(leaked);
        }
      }
    }
  });

  it('ne lit jamais le corps de la réponse', () => {
    const cause = apiError(413);
    Object.defineProperty(cause, 'data', {
      get: () => {
        throw new Error('data must not be read');
      },
    });

    expect(failureMessage(cause, fileReplaceBusiness)).toBe(
      'Ce fichier est trop volumineux pour être envoyé. Choisissez-en un plus léger.',
    );
  });
});
