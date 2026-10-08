import { ApiError } from '@/api/customFetch';
import { PASSWORD_MIN_LENGTH } from '@/features/auth/authFeedback';

/**
 * Copy of `backend/src/common/validation/password-strength.ts`, so the form can
 * refuse before sending. The server's copy is the one that decides: change
 * both together.
 */
const MIN_DISTINCT_CHARACTERS = 5;

/** `MAX_PASSWORD_LENGTH` on the API side. */
const PASSWORD_MAX_LENGTH = 512;

type PasswordWeakness = 'distinct' | 'walk' | 'common' | 'email';

/** What the API puts in `message` for each reason it refuses a password. */
const API_MESSAGES: Record<string, PasswordWeakness> = {
  [`password must contain at least ${MIN_DISTINCT_CHARACTERS} distinct characters`]: 'distinct',
  'password must not be a keyboard or alphabet sequence': 'walk',
  'password is a common password': 'common',
  'password must not reuse the email address': 'email',
};

/** Says what is missing, in a few words. */
const WEAKNESS_COPY: Record<PasswordWeakness, string> = {
  distinct: `Utilisez au moins ${MIN_DISTINCT_CHARACTERS} caractères différents.`,
  walk: 'Évitez les suites comme 123456 ou azerty.',
  common: 'Ce mot de passe est trop courant.',
  email: 'Le mot de passe ne doit pas reprendre votre email.',
};

export const PASSWORD_RULE_HINT = `${PASSWORD_MIN_LENGTH} caractères minimum. Évitez les mots de passe courants, les suites (123456, azerty), les répétitions et votre adresse email.`;

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

const MIN_WALK_LENGTH = 4;

const isLetter = (char: string): boolean => /\p{L}/u.test(char);
const isDigit = (char: string): boolean => char >= '0' && char <= '9';

/** Index scan, not an anchored regex: that one backtracks in O(n²). */
function trimTo(
  chars: string[],
  keep: (char: string) => boolean,
): { start: number; end: number } | null {
  const start = chars.findIndex(keep);

  return start === -1 ? null : { start, end: chars.findLastIndex(keep) };
}

const unleet = (chars: string[]): string => chars.map((char) => LEET[char] ?? char).join('');

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
    (sequence) => sequence.includes(part) || [...sequence].reverse().join('').includes(part),
  );

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

export function passwordWeakness(password: string, email?: string): PasswordWeakness | null {
  if (password.length > PASSWORD_MAX_LENGTH) {
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

    if (lowered === address || lowered === localPart || cores.includes(localPart)) {
      return 'email';
    }
  }

  return null;
}

/** The wording to show for a password the form must not send, or `null`. */
export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_LENGTH} caractères.`;
  }

  const weakness = passwordWeakness(password, email);

  return weakness ? WEAKNESS_COPY[weakness] : null;
}

/** The wording for a 400 where the server refused the password, or `null`
 * when the 400 (or the error) is about something else. */
export function passwordRefusalMessage(caught: unknown): string | null {
  if (!(caught instanceof ApiError) || caught.status !== 400) {
    return null;
  }

  const message = (caught.data as { message?: unknown } | undefined)?.message;
  if (!Array.isArray(message)) {
    return null;
  }

  const weakness = message.map((entry) => API_MESSAGES[String(entry)]).find(Boolean);

  return weakness ? WEAKNESS_COPY[weakness] : null;
}
