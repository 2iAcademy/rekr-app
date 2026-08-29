import { RouteGuard } from '@/features/auth/RouteGuard';
import { OfferFormPage } from '@/features/recruiter-offers/pages/OfferFormPage';
import { RecruiterOffersPage } from '@/features/recruiter-offers/pages/RecruiterOffersPage';

export function RecruiterOffersRoute() {
  return (
    <RouteGuard allowedUserTypes={['recruiter']} forbiddenRedirectTo="/">
      <RecruiterOffersPage />
    </RouteGuard>
  );
}

/**
 * Creation and edition are the same screen: it reads the offer identifier from
 * the URL itself, so the two paths mount one component and nothing here has to
 * tell them apart.
 */
export function OfferFormRoute() {
  return (
    <RouteGuard allowedUserTypes={['recruiter']} forbiddenRedirectTo="/">
      <OfferFormPage />
    </RouteGuard>
  );
}
