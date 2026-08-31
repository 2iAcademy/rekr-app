import { createBrowserRouter } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { AnonymousOnly } from '@/features/auth/AnonymousOnly';
import { HomeRedirect } from '@/features/auth/HomeRedirect';
import { RouteGuard } from '@/features/auth/RouteGuard';
import { CandidateOnboardingRoute } from '@/features/candidate-onboarding/routes';
import { CandidateFeedRoute } from '@/features/candidate-feed/routes';
import { MatchRoute, MatchesRoute } from '@/features/matches/routes';
import {
  ForgotPasswordRoute,
  SigninRoute,
  SignupRoute,
  SplashRoute,
} from '@/features/onboarding/routes';
import { OfferDetailRoute } from '@/features/offers/routes';
import { ProfileRoute } from '@/features/profile/routes';
import { OfferApplicantsRoute } from '@/features/recruiter-candidates/routes';
import { OfferFormRoute, RecruiterOffersRoute } from '@/features/recruiter-offers/routes';
import { RecruiterOnboardingRoute } from '@/features/recruiter-onboarding/routes';

export const routes = [
  {
    element: <AnonymousOnly />,
    children: [
      { path: '/', element: <SplashRoute /> },
      { path: '/inscription', element: <SignupRoute /> },
      { path: '/connexion', element: <SigninRoute /> },
      { path: '/mot-de-passe-oublie', element: <ForgotPasswordRoute /> },
    ],
  },

  { path: '/candidat/onboarding', element: <CandidateOnboardingRoute /> },
  { path: '/recruteur/onboarding', element: <RecruiterOnboardingRoute /> },
  {
    element: <RouteGuard profile="complete" />,
    children: [
      { path: '/offres/:id', element: <OfferDetailRoute /> },
      { path: '/match', element: <MatchRoute /> },
      {
        element: <AppShell />,
        children: [
          { path: '/matches', element: <MatchesRoute /> },
          { path: '/recruteur/offres', element: <RecruiterOffersRoute /> },
          // Declared before the dynamic sibling, which is where a reader looks
          // for the answer; react-router ranks by specificity, so the order is a
          // convention here rather than the thing that keeps them apart.
          { path: '/recruteur/offres/nouvelle', element: <OfferFormRoute /> },
          { path: '/recruteur/offres/:id/edition', element: <OfferFormRoute /> },
          { path: '/recruteur/offres/:id/candidats', element: <OfferApplicantsRoute /> },
          { path: '/candidat/offres', element: <CandidateFeedRoute /> },
          { path: '/profil', element: <ProfileRoute /> },
        ],
      },
    ],
  },

  { path: '*', element: <HomeRedirect /> },
];

export const router = createBrowserRouter(routes);
