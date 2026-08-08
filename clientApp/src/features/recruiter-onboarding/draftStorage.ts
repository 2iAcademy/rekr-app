import {
  COMPANY_SIZES,
  CONTRACT_TYPES,
  EXPERIENCE_LEVELS,
  REMOTE_POLICIES,
  emptyRecruiterOnboarding,
  type RecruiterOnboardingState,
} from './state';

const DRAFT_STORAGE_PREFIX = 'rekr:recruiter-onboarding:v2';

export const draftStorageKey = (userId: number): string =>
  `${DRAFT_STORAGE_PREFIX}:${String(userId)}`;

const fieldsOfType = (predicate: (value: unknown) => boolean) =>
  Object.keys(emptyRecruiterOnboarding).filter((key) =>
    predicate(emptyRecruiterOnboarding[key as keyof RecruiterOnboardingState]),
  ) as (keyof RecruiterOnboardingState)[];

const LIST_FIELDS = fieldsOfType(Array.isArray);
const STRING_FIELDS = fieldsOfType((value) => typeof value === 'string');

const ENUM_FIELDS = {
  size: COMPANY_SIZES,
  contractType: CONTRACT_TYPES,
  minExperienceLevel: EXPERIENCE_LEVELS,
  remotePolicy: REMOTE_POLICIES,
} as const satisfies Partial<Record<keyof RecruiterOnboardingState, readonly string[]>>;

const isState = (value: unknown): value is RecruiterOnboardingState => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    STRING_FIELDS.every((field) => typeof candidate[field] === 'string') &&
    LIST_FIELDS.every(
      (field) =>
        Array.isArray(candidate[field]) &&
        (candidate[field] as unknown[]).every((item) => typeof item === 'string'),
    ) &&
    Object.entries(ENUM_FIELDS).every(
      ([field, allowed]) =>
        candidate[field] === '' ||
        (allowed as readonly string[]).includes(candidate[field] as string),
    )
  );
};

/**
 * Session storage, not local: the draft should survive a reload or a failed
 * publish, not reappear days later in a tab the recruiter had forgotten. The key
 * carries the user id so a second login in the same tab cannot inherit the
 * first recruiter's identity, and a version so narrowing an enum retires every
 * draft written against the old domain instead of restoring a value the API
 * would now reject.
 */
export const loadDraft = (userId: number): RecruiterOnboardingState | null => {
  try {
    const raw = sessionStorage.getItem(draftStorageKey(userId));
    if (raw === null) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    return isState(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const saveDraft = (userId: number, state: RecruiterOnboardingState): void => {
  try {
    sessionStorage.setItem(draftStorageKey(userId), JSON.stringify(state));
  } catch {
    // A full or disabled storage must not break the form.
  }
};

export const clearDraft = (userId: number): void => {
  try {
    sessionStorage.removeItem(draftStorageKey(userId));
  } catch {
    // Nothing to recover from: the draft is best-effort.
  }
};

export const clearAllDrafts = (): void => {
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(DRAFT_STORAGE_PREFIX))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Nothing to recover from: the draft is best-effort.
  }
};
