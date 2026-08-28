import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { isRecruiter } from '@/domain/userType';
import { useAuth } from '@/features/auth/useAuth';
import { OfferFormPage } from '@/features/recruiter-offers/pages/OfferFormPage';
import { RecruiterOffersPage } from '@/features/recruiter-offers/pages/RecruiterOffersPage';

interface RecruiterOnlyProps {
  children: ReactNode;
}

/**
 * The access rule of the three offer screens, held in one place because they
 * share it exactly. `AppShell` settles the session and turns an anonymous
 * visitor away, but it guards no role: without this, a candidate who types the
 * URL lands on the recruiter's screens.
 *
 * `loading` renders nothing rather than redirecting: the session is not known
 * yet, and sending the visitor away here would eject a recruiter who merely
 * refreshed the page.
 */
function RecruiterOnly({ children }: RecruiterOnlyProps) {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return null;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/connexion" replace />;
  }

  if (!isRecruiter(user?.userType)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export function RecruiterOffersRoute() {
  return (
    <RecruiterOnly>
      <RecruiterOffersPage />
    </RecruiterOnly>
  );
}

/**
 * Creation and edition are the same screen: it reads the offer identifier from
 * the URL itself, so the two paths mount one component and nothing here has to
 * tell them apart.
 */
export function OfferFormRoute() {
  return (
    <RecruiterOnly>
      <OfferFormPage />
    </RecruiterOnly>
  );
}
