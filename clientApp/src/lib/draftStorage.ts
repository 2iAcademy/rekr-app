const DRAFT_PREFIX = 'rekr:onboarding-draft';

export interface DraftStorage<State> {
  key: (userId: number) => string;
  load: (userId: number) => State | null;
  save: (userId: number, state: State) => void;
  clear: (userId: number) => void;
}

const fieldsOfType = <State extends object>(
  empty: State,
  predicate: (value: unknown) => boolean,
): (keyof State)[] =>
  (Object.keys(empty) as (keyof State)[]).filter((key) => predicate(empty[key]));

/**
 * Session storage, not local: a draft should survive a reload or a failed
 * publish, not reappear days later in a tab the user had forgotten. The key
 * carries the user id so a second login in the same tab cannot inherit the
 * first user's identity, and a version so narrowing an enum retires every
 * draft written against the old domain instead of restoring a value the API
 * would now reject.
 *
 * The shape check is derived from `empty`, so a field added to the state is
 * covered without touching this module. Only enums need declaring: their
 * allowed values are what a version bump is meant to retire.
 */
export const createDraftStorage = <State extends object>(
  name: string,
  version: number,
  empty: State,
  enumFields: Partial<Record<keyof State, readonly string[]>>,
): DraftStorage<State> => {
  const prefix = `${DRAFT_PREFIX}:${name}:v${String(version)}`;
  const listFields = fieldsOfType(empty, Array.isArray);
  const stringFields = fieldsOfType(empty, (value) => typeof value === 'string');

  const key = (userId: number): string => `${prefix}:${String(userId)}`;

  const isState = (value: unknown): value is State => {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Record<string, unknown>;

    return (
      stringFields.every((field) => typeof candidate[field as string] === 'string') &&
      listFields.every(
        (field) =>
          Array.isArray(candidate[field as string]) &&
          (candidate[field as string] as unknown[]).every((item) => typeof item === 'string'),
      ) &&
      Object.entries(enumFields).every(
        ([field, allowed]) =>
          candidate[field] === '' ||
          (allowed as readonly string[]).includes(candidate[field] as string),
      )
    );
  };

  return {
    key,

    load: (userId) => {
      try {
        const raw = sessionStorage.getItem(key(userId));
        if (raw === null) {
          return null;
        }

        const parsed: unknown = JSON.parse(raw);

        return isState(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },

    save: (userId, state) => {
      try {
        sessionStorage.setItem(key(userId), JSON.stringify(state));
      } catch {
        // A full or disabled storage must not break the form.
      }
    },

    clear: (userId) => {
      try {
        sessionStorage.removeItem(key(userId));
      } catch {
        // Nothing to recover from: the draft is best-effort.
      }
    },
  };
};

// Every wizard at once, whatever the role: logging out must not leave the next
// session with the previous user's half-written profile.
export const clearAllDrafts = (): void => {
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(DRAFT_PREFIX))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Nothing to recover from: the draft is best-effort.
  }
};
