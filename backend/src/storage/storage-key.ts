/**
 * Storage keys, the only thing the database ever holds about a file.
 *
 * `candidate_profile.picture`, `candidate_profile.cv_url`, `company.logo` and
 * `company.cover_image` store a key such as
 * `candidates/12/cv/<uuid>.pdf` — never an absolute URL. A URL in a column
 * freezes the storage driver and the public hostname into the data: moving
 * either one would mean rewriting every row. URLs are derived on read instead.
 *
 * The random file name is what makes a key unguessable, which is what lets the
 * image reads stay unauthenticated. The owner id in the path is there for
 * humans reading `du -sh` output, not for access control — nothing trusts it.
 */
import { randomUUID } from 'node:crypto';
import {
  FILE_KINDS,
  FileExtension,
  FileKind,
  FileScope,
  isFileKind,
} from './file-kind';

export interface StorageKeyParts {
  scope: FileScope;
  ownerId: number;
  kind: FileKind;
  extension: FileExtension;
}

/**
 * A negated character class, deliberately unanchored.
 *
 * The intuitive spelling of this check is an anchored allowlist,
 * `/^[a-z0-9.\-/]+$/` — and it is wrong. In JavaScript `$` also matches
 * *before* a trailing newline, so that pattern accepts
 * `candidates/1/picture/<uuid>.png\n`, which then reaches the filesystem with a
 * newline glued to the name. Asking whether any forbidden character is present
 * has no anchor to abuse.
 *
 * The class is what rejects, in one pass: null bytes, newlines, backslashes,
 * `~`, `:`, and `%` — so a percent-encoded traversal (`%2e%2e%2f`) never gets
 * the chance to be decoded downstream. Uppercase is out too, which keeps the
 * key canonical on case-insensitive filesystems.
 */
const FORBIDDEN_CHARACTER = /[^a-z0-9.\-/]/;
const OWNER_SEGMENT = /^[1-9][0-9]*$/;
const FILE_NAME_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.([a-z0-9]+)$/;
const SEGMENT_COUNT = 4;

export function buildStorageKey(
  scope: FileScope,
  ownerId: number,
  kind: FileKind,
  extension: FileExtension,
): string {
  if (!Number.isInteger(ownerId) || ownerId < 1) {
    throw new Error(
      `A storage key needs a positive integer owner, received "${String(ownerId)}".`,
    );
  }

  const definition = FILE_KINDS[kind];
  if (definition === undefined) {
    throw new Error(`Unknown file kind "${String(kind)}".`);
  }
  if (definition.scope !== scope) {
    throw new Error(
      `File kind "${kind}" belongs to "${definition.scope}", not "${scope}".`,
    );
  }
  if (!definition.extensions.includes(extension)) {
    throw new Error(
      `File kind "${kind}" does not accept the "${extension}" extension.`,
    );
  }

  return `${scope}/${ownerId}/${kind}/${randomUUID()}.${extension}`;
}

export function parseStorageKey(candidate: unknown): StorageKeyParts | null {
  if (typeof candidate !== 'string' || FORBIDDEN_CHARACTER.test(candidate)) {
    return null;
  }

  const segments = candidate.split('/');
  if (segments.length !== SEGMENT_COUNT) {
    return null;
  }

  const [scope, owner, kind, fileName] = segments;
  if (!isFileKind(kind) || FILE_KINDS[kind].scope !== scope) {
    return null;
  }
  if (!OWNER_SEGMENT.test(owner)) {
    return null;
  }

  const fileNameMatch = FILE_NAME_SEGMENT.exec(fileName);
  if (fileNameMatch === null) {
    return null;
  }

  const extension = fileNameMatch[1] as FileExtension;
  if (!FILE_KINDS[kind].extensions.includes(extension)) {
    return null;
  }

  return {
    scope: FILE_KINDS[kind].scope,
    ownerId: Number(owner),
    kind,
    extension,
  };
}

export function isStorageKey(candidate: unknown): boolean {
  return parseStorageKey(candidate) !== null;
}
