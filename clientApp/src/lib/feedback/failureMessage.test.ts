import { describe, it, expect } from 'vitest';
import { ApiError } from '@/api/customFetch';
import { loginBusiness, signupBusiness } from '@/features/auth/authFeedback';
import { failureMessage } from './failureMessage';

const TECHNICAL = 'Une erreur est survenue. Réessayez dans un instant.';
const UNREACHABLE = 'Connexion au serveur impossible. Vérifiez votre connexion et réessayez.';
const INVALID_INPUT = 'Vérifiez votre email et votre mot de passe (8 caractères minimum).';
const TOO_MANY_ATTEMPTS = 'Trop de tentatives. Patientez une minute avant de réessayer.';
const BAD_CREDENTIALS =
  'Email ou mot de passe incorrect. Réessayez ou réinitialisez votre mot de passe.';
const INACTIVE_ACCOUNT = 'Ce compte est désactivé. Contactez-nous pour le réactiver.';
const DUPLICATE_EMAIL =
  'Un compte existe déjà pour cet email. Connectez-vous ou utilisez une autre adresse.';

const apiError = (status: number, data: unknown) =>
  new ApiError({ status, statusText: '', url: '/api/auth/signup', data });

describe('failureMessage', () => {
  it('annonce un email déjà utilisé sur un 409 à inscription', () => {
    const cause = apiError(409, {
      statusCode: 409,
      message: 'An account already exists for this email.',
      error: 'Conflict',
    });

    expect(failureMessage(cause, signupBusiness)).toBe(DUPLICATE_EMAIL);
  });

  it('annonce des identifiants incorrects sur un 401 à connexion', () => {
    const cause = apiError(401, {
      statusCode: 401,
      message: 'Invalid email or password.',
      error: 'Unauthorized',
    });

    expect(failureMessage(cause, loginBusiness)).toBe(BAD_CREDENTIALS);
  });

  it('annonce un compte désactivé sur un 403 à connexion', () => {
    const cause = apiError(403, {
      statusCode: 403,
      message: 'This account is inactive.',
      error: 'Forbidden',
    });

    expect(failureMessage(cause, loginBusiness)).toBe(INACTIVE_ACCOUNT);
  });

  it('invite à vérifier la saisie sur un 400, dont le message backend est un tableau', () => {
    const cause = apiError(400, {
      statusCode: 400,
      message: ['email must be an email', 'password must be longer than or equal to 8 characters'],
      error: 'Bad Request',
    });

    expect(failureMessage(cause, signupBusiness)).toBe(INVALID_INPUT);
    expect(failureMessage(cause, loginBusiness)).toBe(INVALID_INPUT);
  });

  it('invite à patienter sur un 429, pour les deux opérations', () => {
    const cause = apiError(429, {
      statusCode: 429,
      message: 'ThrottlerException: Too Many Requests',
    });

    expect(failureMessage(cause, signupBusiness)).toBe(TOO_MANY_ATTEMPTS);
    expect(failureMessage(cause, loginBusiness)).toBe(TOO_MANY_ATTEMPTS);
  });

  it('reste génerique sur une erreur technique 500', () => {
    const cause = apiError(500, { statusCode: 500, message: 'Internal server error' });

    expect(failureMessage(cause, signupBusiness)).toBe(TECHNICAL);
    expect(failureMessage(cause, loginBusiness)).toBe(TECHNICAL);
  });

  it('reste génerique sur un 503', () => {
    expect(failureMessage(apiError(503, undefined), loginBusiness)).toBe(TECHNICAL);
  });

  it('reste génerique sur un statut inconnu', () => {
    expect(failureMessage(apiError(418, undefined), signupBusiness)).toBe(TECHNICAL);
  });

  it('signale un problème de connexion quand aucune réponse HTTP n’est parvenue', () => {
    expect(failureMessage(new TypeError('Failed to fetch'), loginBusiness)).toBe(UNREACHABLE);
  });

  it('ne partage pas les messages métier entre opérations', () => {
    expect(failureMessage(apiError(403, undefined), signupBusiness)).toBe(TECHNICAL);
    expect(failureMessage(apiError(401, undefined), signupBusiness)).toBe(TECHNICAL);
    expect(failureMessage(apiError(409, undefined), loginBusiness)).toBe(TECHNICAL);
  });

  it('distingue un compte désactivé et un rate limit d’identifiants incorrects', () => {
    const badCredentials = failureMessage(apiError(401, undefined), loginBusiness);

    expect(failureMessage(apiError(403, undefined), loginBusiness)).not.toBe(badCredentials);
    expect(failureMessage(apiError(429, undefined), loginBusiness)).not.toBe(badCredentials);
  });

  it('never leaks a backend string, whatever the status', () => {
    const backendStrings = [
      'Internal server error',
      'ThrottlerException',
      'Bad Request',
      'Unauthorized',
      'Forbidden',
      'Conflict',
      'Invalid email or password.',
      'This account is inactive.',
      'An account already exists for this email.',
      'email must be an email',
    ];

    for (const status of [400, 401, 403, 409, 429, 500, 503, 418]) {
      for (const business of [signupBusiness, loginBusiness]) {
        const message = failureMessage(apiError(status, { statusCode: status }), business);

        for (const leaked of backendStrings) {
          expect(message).not.toContain(leaked);
        }
      }
    }
  });

  it('never reads the backend body', () => {
    const cause = apiError(409, undefined);
    Object.defineProperty(cause, 'data', {
      get: () => {
        throw new Error('data must not be read');
      },
    });

    expect(failureMessage(cause, signupBusiness)).toBe(DUPLICATE_EMAIL);
  });
});
