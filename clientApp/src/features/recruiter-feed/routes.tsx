import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { RouteGuard } from '@/features/auth/RouteGuard';
import { RecruiterFeedPage } from '@/features/recruiter-feed/pages/RecruiterFeedPage';

// The detail screen is a state of the feed, not a route: the deck lives in the
// page, and a real route would unmount it and lose every decision already taken.
const PROFILE_PARAM = 'profil';

// `Number` is far too forgiving here — `Number('')` is 0 and `Number(' 3 ')` is
// 3 — so a bare run of digits is the only thing that counts as an identifier.
const parseCandidateId = (raw: string | null): number | null => {
  if (raw === null || !/^\d+$/.test(raw)) {
    return null;
  }

  const id = Number(raw);

  return id > 0 ? id : null;
};

export function RecruiterFeedRoute() {
  return (
    <RouteGuard allowedUserTypes={['recruiter']}>
      <RecruiterFeedContent />
    </RouteGuard>
  );
}

function RecruiterFeedContent() {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawProfile = searchParams.get(PROFILE_PARAM);
  const openCandidateId = parseCandidateId(rawProfile);

  // The canonical spelling of an identifier, or `null` when the parameter names
  // nobody. Comparing it to the raw value answers both questions at once: an
  // unreadable parameter has to go, a padded one has to be rewritten, and an
  // absent one is already canonical since both sides are then `null`.
  const canonicalProfile = openCandidateId === null ? null : String(openCandidateId);
  const isProfileCanonical = rawProfile === canonicalProfile;

  // This content only mounts once `RouteGuard` has admitted a recruiter. Keeping
  // the URL effect below that boundary means a rejected visitor's URL is never
  // rewritten before their redirect.
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

  const openProfile = (id: number): void => {
    const next = new URLSearchParams(searchParams);
    next.set(PROFILE_PARAM, String(id));

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
    <RecruiterFeedPage
      openCandidateId={openCandidateId}
      onOpenProfile={openProfile}
      onCloseProfile={closeProfile}
    />
  );
}
