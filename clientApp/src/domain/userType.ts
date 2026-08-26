export const USER_TYPES = ['candidate', 'recruiter'] as const;

export type UserType = (typeof USER_TYPES)[number];

const USER_TYPE_LABELS: Record<UserType, string> = {
  candidate: 'Candidat',
  recruiter: 'Recruteur',
};

const isUserType = (value: string): value is UserType =>
  (USER_TYPES as readonly string[]).includes(value);

/**
 * Whether a session belongs to a recruiter. `AuthenticatedUser.userType` is an
 * unconstrained string, and this comparison used to be spelled out at each call
 * site: holding it here is what keeps the four of them from drifting apart.
 */
export const isRecruiter = (userType: string | undefined): boolean => userType === 'recruiter';

/** Counterpart of `isRecruiter`, for the screens reserved to candidates. */
export const isCandidate = (userType: string | undefined): boolean => userType === 'candidate';

/**
 * Display label for a session's `userType`, which the auth context types as an
 * unconstrained string. An unrecognised value falls back to the candidate
 * label: it is the least privileged of the two, so a corrupted or future type
 * never gets announced as a recruiter.
 */
export function userTypeLabel(userType: string): string {
  return isUserType(userType) ? USER_TYPE_LABELS[userType] : USER_TYPE_LABELS.candidate;
}
