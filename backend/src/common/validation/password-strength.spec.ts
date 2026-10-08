import { passwordWeakness } from './password-strength';

describe('passwordWeakness', () => {
  it.each(['aaaaaaaa', '12121212', 'abababab', 'éééééééé'])(
    'refuses %s for its too few distinct characters',
    (password) => {
      expect(passwordWeakness(password)).toBe('distinct');
    },
  );

  it.each([
    '12345678',
    '87654321',
    'abcdefgh',
    'Azertyuiop',
    'qwertyui',
    '12345678!',
    '123456789a',
    'qsdfghjklm1',
    'abcd1234',
  ])('refuses the walk %s, decorated or not', (password) => {
    expect(passwordWeakness(password)).toBe('walk');
  });

  it.each([
    'motdepasse',
    'Motdepasse1!',
    'P@ssw0rd',
    'password2024',
    '2024Soleil!',
    'rekr2026!',
    '$oleil2024',
    '@dministrateur',
    '4dmin2024',
    'Motdepass3!',
  ])('refuses the common password %s, decoration and all', (password) => {
    expect(passwordWeakness(password)).toBe('common');
  });

  it('refuses the account address and its local part', () => {
    const email = 'jeanne.dupont@test.dev';

    expect(passwordWeakness('Jeanne.Dupont@test.dev', email)).toBe('email');
    expect(passwordWeakness('jeanne.dupont', email)).toBe('email');
    expect(passwordWeakness('jeanne.dupont2026!', email)).toBe('email');
  });

  it.each([
    'Sup3rSecret!',
    'correct-horse-battery-staple',
    'les chats dorment au soleil',
    'Tr0mbone-Vert',
    'développeuse à Lyon',
  ])('accepts %s', (password) => {
    expect(passwordWeakness(password, 'jeanne.dupont@test.dev')).toBeNull();
  });

  it('does not mistake trailing digits for leetspeak', () => {
    expect(passwordWeakness('Soleil2024')).toBe('common');
    expect(passwordWeakness('Marie2001!')).toBeNull();
  });

  // The anchored regex this replaced took ~5 s on such a payload, before the
  // length bound had a chance to refuse it.
  it('answers at once on an oversized payload, left to the length bound', () => {
    const huge = `a${'1234 '.repeat(19_000)}a`;
    const started = Date.now();

    expect(passwordWeakness(huge)).toBeNull();
    expect(Date.now() - started).toBeLessThan(100);
  });

  it('does not judge the length: the DTO bounds do', () => {
    expect(passwordWeakness('k7#Qz')).toBeNull();
  });
});
