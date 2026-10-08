import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/customFetch';
import { passwordProblem, passwordRefusalMessage, passwordWeakness } from './passwordRule';

const apiError = (status: number, data: unknown) =>
  new ApiError({ status, statusText: '', url: '/api/auth/signup', data });

// Les mêmes cas que `password-strength.spec.ts` côté API : les deux copies de la
// règle doivent rendre le même verdict.
describe('passwordWeakness', () => {
  it.each([
    ['aaaaaaaa', 'distinct'],
    ['12121212', 'distinct'],
    ['12345678', 'walk'],
    ['Azertyuiop', 'walk'],
    ['Motdepasse1!', 'common'],
    ['P@ssw0rd', 'common'],
    ['2024Soleil!', 'common'],
    ['rekr2026!', 'common'],
    ['$oleil2024', 'common'],
    ['@dministrateur', 'common'],
    ['Motdepass3!', 'common'],
    ['12345678!', 'walk'],
    ['qsdfghjklm1', 'walk'],
    ['abcd1234', 'walk'],
  ])('refuse %s (%s)', (password, weakness) => {
    expect(passwordWeakness(password)).toBe(weakness);
  });

  it('refuse l’adresse du compte et sa partie locale', () => {
    expect(passwordWeakness('Jeanne.Dupont@test.dev', 'jeanne.dupont@test.dev')).toBe('email');
    expect(passwordWeakness('jeanne.dupont2026!', 'jeanne.dupont@test.dev')).toBe('email');
  });

  it.each(['Sup3rSecret!', 'correct-horse-battery-staple', 'développeuse à Lyon'])(
    'accepte %s',
    (password) => {
      expect(passwordWeakness(password, 'jeanne.dupont@test.dev')).toBeNull();
    },
  );
});

describe('passwordProblem', () => {
  it('parle de longueur avant le reste', () => {
    expect(passwordProblem('aaa')).toBe('Le mot de passe doit contenir au moins 8 caractères.');
  });

  it.each([
    ['aaaaaaaa', 'Utilisez au moins 5 caractères différents.'],
    ['12345678', 'Évitez les suites comme 123456 ou azerty.'],
    ['Motdepasse1!', 'Ce mot de passe est trop courant.'],
  ])('dit ce qui manque à %s', (password, message) => {
    expect(passwordProblem(password)).toBe(message);
  });

  it('refuse au-delà de la borne de l’API, sans examiner le reste', () => {
    expect(passwordProblem(`a${'1234 '.repeat(19_000)}a`)).toBe(
      'Le mot de passe ne doit pas dépasser 512 caractères.',
    );
  });

  it('ne dit rien d’un mot de passe acceptable', () => {
    expect(passwordProblem('Tr0mbone-Vert')).toBeNull();
  });
});

describe('passwordRefusalMessage', () => {
  it('traduit le motif renvoyé par l’API', () => {
    expect(
      passwordRefusalMessage(
        apiError(400, { message: ['password must not reuse the email address'] }),
      ),
    ).toBe('Le mot de passe ne doit pas reprendre votre email.');
  });

  it('ne confond pas un lien refusé avec un mot de passe refusé', () => {
    expect(
      passwordRefusalMessage(
        apiError(400, { message: "Ce lien de réinitialisation n'est plus valide." }),
      ),
    ).toBeNull();
    expect(passwordRefusalMessage(new Error('réseau'))).toBeNull();
  });
});
