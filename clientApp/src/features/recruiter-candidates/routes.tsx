import { useEffect } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router';
import { RouteGuard } from '@/features/auth/RouteGuard';
import { OfferApplicantsPage } from './pages/OfferApplicantsPage';

// The profile is a state of the list, not a route: the list lives in the page,
// and a real route would unmount it and lose the likes just given.
const PROFILE_PARAM = 'profil';

/**
 * `Number` is far too forgiving here — `Number('')` is 0 and `Number(' 3 ')` is
 * 3 — so a bare run of digits is the only thing that counts as an identifier.
 */
const parseId = (raw: string | null): number | null => {
  if (raw === null || !/^\d+$/.test(raw)) {
    return null;
  }

  const id = Number(raw);

  return id > 0 ? id : null;
};

/**
 * Recruiter-only, through the shared guard: the access rule lives in one place
 * for every feature route, and this screen adds only the reading of its own two
 * URL parts on top of it.
 */
export function OfferApplicantsRoute() {
  return (
    <RouteGuard allowedUserTypes={['recruiter']} forbiddenRedirectTo="/">
      <OfferApplicants />
    </RouteGuard>
  );
}

function OfferApplicants() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const offerId = parseId(id ?? null);
  const rawProfile = searchParams.get(PROFILE_PARAM);
  const openApplicantId = parseId(rawProfile);

  /**
   * The canonical spelling of an identifier, or `null` when the parameter names
   * nobody. Comparing it to the raw value answers both questions at once: an
   * unreadable parameter has to go, a padded one has to be rewritten, and an
   * absent one is already canonical since both sides are then `null`.
   */
  const canonicalProfile = openApplicantId === null ? null : String(openApplicantId);
  const isProfileCanonical = rawProfile === canonicalProfile;

  // Declared above the redirect below so the hook is always called, and guarded
  // inside rather than around: rewriting the search params of a visitor who is
  // being sent elsewhere would only add a navigation before the redirect.
  useEffect(() => {
    if (isProfileCanonical) {
      return;
    }

    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (canonicalProfile === null) {
          next.delete(PROFILE_PARAM);
        } else {
          next.set(PROFILE_PARAM, canonicalProfile);
        }

        return next;
      },
      // Replaced: this corrects what the recruiter typed, it is not a step they
      // should have to walk back through.
      { replace: true },
    );
  }, [canonicalProfile, isProfileCanonical, setSearchParams]);

  // An unreadable offer id in the path is not a screen to word: there is no
  // offer to show, so the recruiter goes back to the list they came from.
  if (offerId === null) {
    return <Navigate to="/recruteur/offres" replace />;
  }

  const openProfile = (candidateUserId: number): void => {
    const next = new URLSearchParams(searchParams);
    next.set(PROFILE_PARAM, String(candidateUserId));

    // Pushed: the browser back button has to close the profile.
    setSearchParams(next);
  };

  const closeProfile = (): void => {
    const next = new URLSearchParams(searchParams);
    next.delete(PROFILE_PARAM);

    // Replaced: closing must not leave behind an entry that reopens the profile
    // on the next back.
    setSearchParams(next, { replace: true });
  };

  return (
    <OfferApplicantsPage
      offerId={offerId}
      openApplicantId={openApplicantId}
      onOpenProfile={openProfile}
      onCloseProfile={closeProfile}
    />
  );
}
