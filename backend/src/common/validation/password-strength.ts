import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { MAX_PASSWORD_LENGTH } from './password-bounds';

/**
 * The rule a new password must pass, at signup and at reset alike.
 *
 * Shaped on NIST SP 800-63B rather than on character classes (see
 * `password-bounds.ts`): length, then a refusal of what an attacker tries
 * first — a run of one character, a keyboard or alphabet walk, a password off
 * the common lists, the account's own address. "Sup3rSecret!" passes, and so
 * does a long lowercase passphrase; "aaaaaaaa", "12345678" and "Motdepasse1!"
 * do not.
 *
 * Mirrored in `clientApp/src/features/auth/passwordRule.ts` so the form can
 * refuse before sending; this copy is the one that decides. Change both.
 */
export const MIN_PASSWORD_LENGTH = 8;

/** "aaaaaaaa" has one, "12121212" two: neither is a password. */
export const MIN_DISTINCT_CHARACTERS = 5;

/** One message per way of failing, so the form can say what is missing.
 * The client maps each of them to its own wording: keep them stable. */
export const WEAK_PASSWORD_MESSAGES = {
  distinct: `password must contain at least ${MIN_DISTINCT_CHARACTERS} distinct characters`,
  walk: 'password must not be a keyboard or alphabet sequence',
  common: 'password is a common password',
  email: 'password must not reuse the email address',
} as const;

export type PasswordWeakness = keyof typeof WEAK_PASSWORD_MESSAGES;

/** Rows walked by hand on a French or an English keyboard, and the two orders
 * nobody needs a keyboard for. A password lying inside one, either way, is a
 * walk. */
const SEQUENCES = [
  '01234567890',
  'abcdefghijklmnopqrstuvwxyz',
  'azertyuiop',
  'qsdfghjklm',
  'wxcvbn',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
];

/** Compared once the decoration is gone (see `coresOf`), so "Soleil2024!" is
 * "soleil" here. Short on purpose: the first guesses, French ones included,
 * and the words the product itself suggests. */
const COMMON_PASSWORDS = new Set([
  'abc',
  'admin',
  'administrateur',
  'azerty',
  'azertyuiop',
  'baseball',
  'batman',
  'bienvenue',
  'bonjour',
  'candidat',
  'changeme',
  'chocolat',
  'chouchou',
  'doudou',
  'dragon',
  'emploi',
  'football',
  'freedom',
  'iloveyou',
  'jetaime',
  'letmein',
  'loulou',
  'marseille',
  'master',
  'monkey',
  'motdepasse',
  'pass',
  'passe',
  'passwd',
  'password',
  'pokemon',
  'princesse',
  'qwerty',
  'qwertyuiop',
  'recrutement',
  'recruteur',
  'rekr',
  'secret',
  'shadow',
  'soleil',
  'starwars',
  'sunshine',
  'superman',
  'travail',
  'trustno',
  'welcome',
  'whatever',
]);

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

/** Shorter than this, a run of letters or digits inside a sequence is too
 * common to refuse on its own ("abc" in "Fabcourt", "123" in a postcode). */
const MIN_WALK_LENGTH = 4;

const isLetter = (char: string): boolean => /\p{L}/u.test(char);
const isDigit = (char: string): boolean => char >= '0' && char <= '9';

/** The span between the first and the last character `keep` accepts. Index
 * scan rather than an anchored regex: `/[^\p{L}]+$/` backtracks in O(n²) over
 * a long run of non-letters, and this runs before the length bound refuses. */
function trimTo(
  chars: string[],
  keep: (char: string) => boolean,
): { start: number; end: number } | null {
  const start = chars.findIndex(keep);

  return start === -1 ? null : { start, end: chars.findLastIndex(keep) };
}

const unleet = (chars: string[]): string =>
  chars.map((char) => LEET[char] ?? char).join('');

/** The word the user actually chose: the letters once the digits and symbols
 * tacked on either end are dropped and the usual substitutions undone. The
 * character just outside on each side is tried as a substitution too, since
 * stripping it first would let "$oleil2024" through as "oleil". */
function coresOf(chars: string[]): string[] {
  const span = trimTo(chars, isLetter);
  if (!span) {
    return [''];
  }

  const core = unleet(chars.slice(span.start, span.end + 1));
  const before = LEET[chars[span.start - 1]] ?? '';
  const after = LEET[chars[span.end + 1]] ?? '';

  return [core, before + core, core + after, before + core + after];
}

const insideSequence = (part: string): boolean =>
  SEQUENCES.some(
    (sequence) =>
      sequence.includes(part) ||
      [...sequence].reverse().join('').includes(part),
  );

/** A walk, whole or once decorated: "12345678!" and "qsdfghjklm1" are the
 * same walk as their bare run. */
function isWalk(chars: string[]): boolean {
  if (insideSequence(chars.join(''))) {
    return true;
  }

  return [isLetter, isDigit].some((keep) => {
    const span = trimTo(chars, keep);
    const part = span ? chars.slice(span.start, span.end + 1).join('') : '';

    return part.length >= MIN_WALK_LENGTH && insideSequence(part);
  });
}

/**
 * Why the password is refused, or `null`. Length is not judged here — the
 * DTOs keep their `@MinLength` / `@MaxLength`, which word their own message —
 * but a password past the upper bound is not even looked at: it is refused
 * anyway, and nothing should spend time on a payload sent to be expensive.
 */
export function passwordWeakness(
  password: string,
  email?: string,
): PasswordWeakness | null {
  if (password.length > MAX_PASSWORD_LENGTH) {
    return null;
  }

  const lowered = password.toLowerCase();
  const chars = [...lowered];
  const cores = coresOf(chars);

  if (new Set(chars).size < MIN_DISTINCT_CHARACTERS) {
    return 'distinct';
  }

  if (isWalk(chars)) {
    return 'walk';
  }

  if (cores.some((core) => COMMON_PASSWORDS.has(core))) {
    return 'common';
  }

  if (email) {
    const address = email.toLowerCase();
    const localPart = address.split('@')[0];

    if (
      lowered === address ||
      lowered === localPart ||
      cores.includes(localPart)
    ) {
      return 'email';
    }
  }

  return null;
}

const emailOf = (args: ValidationArguments): string | undefined => {
  const email = (args.object as { email?: unknown }).email;

  return typeof email === 'string' ? email : undefined;
};

/**
 * Applies `passwordWeakness`, against the `email` field of the same payload when
 * there is one. The reset payload carries none: the service checks the
 * account's address itself.
 */
export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (typeof value !== 'string') {
            return true;
          }

          return passwordWeakness(value, emailOf(args)) === null;
        },
        defaultMessage(args: ValidationArguments): string {
          const weakness = passwordWeakness(String(args.value), emailOf(args));

          return weakness ? WEAK_PASSWORD_MESSAGES[weakness] : '';
        },
      },
    });
  };
}
