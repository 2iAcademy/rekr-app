import { isCandidate, isRecruiter } from '@/domain/userType';
import type { AuthenticatedUser } from '@/features/auth/auth-context';

/** Public entry point. The only destination that exists without a session. */
export const PUBLIC_HOME = '/';

/**
 * Where a session belongs once it is settled.
 *
 * Every "go back home" in the application used to be spelled `navigate('/')`,
 * which is the splash — so signing in, finishing a wizard or dismissing a match
 * all landed an authenticated user on the anonymous entry screen. Naming the
 * destination once is what stops the eleven call sites from disagreeing about
 * where home is.
 */
export function homePathFor(user: AuthenticatedUser | null): string {
  if (user === null) {
    return PUBLIC_HOME;
  }

  if (isCandidate(user.userType)) {
    return user.hasProfile ? '/candidat/offres' : '/candidat/onboarding';
  }

  if (isRecruiter(user.userType)) {
    // Their offers, not a deck of candidates: a recruiter publishes a post and
    // reads who applied to it, on the post itself.
    return user.hasProfile ? '/recruteur/offres' : '/recruteur/onboarding';
  }

  /*
   * An account type with no journey of its own — `admin` exists in the schema
   * and owns neither profile table. Sending it to an onboarding it can never
   * complete would bounce it forever against that wizard's own role guard, so
   * it lands on the one screen open to every session instead.
   *
   * `/profil` and not `/matches`: the match list is a candidate route now, and
   * its guard sends a refused visitor back to `homePathFor` — which would send
   * an admin straight back to it, forever.
   */
  return '/profil';
}

/**
 * Whether the session still owes the profile its account type requires.
 *
 * Answered from the type rather than from `hasProfile` alone: an account type
 * that owns no profile table can never satisfy the gate, and would bounce
 * between it and the wizard's own role guard for as long as it stayed signed in.
 */
export function needsOnboarding(user: AuthenticatedUser | null): boolean {
  if (user === null) {
    return false;
  }

  return (isCandidate(user.userType) || isRecruiter(user.userType)) && !user.hasProfile;
}
