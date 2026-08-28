import { createBrowserRouter } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { AnonymousOnly } from '@/features/auth/AnonymousOnly';
import { HomeRedirect } from '@/features/auth/HomeRedirect';
import { RequireOnboarding } from '@/features/auth/RequireOnboarding';
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
import { RecruiterFeedRoute } from '@/features/recruiter-feed/routes';
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

  /*
   * Outside `RequireOnboarding`: these are the screens that resolve it. Inside,
   * the gate would redirect to the wizard from the wizard.
   */
  { path: '/candidat/onboarding', element: <CandidateOnboardingRoute /> },
  { path: '/recruteur/onboarding', element: <RecruiterOnboardingRoute /> },

  {
    element: <RequireOnboarding />,
    children: [
      { path: '/offres/:id', element: <OfferDetailRoute /> },
      { path: '/match', element: <MatchRoute /> },
      {
        element: <AppShell />,
        children: [
          { path: '/matches', element: <MatchesRoute /> },
          { path: '/recruteur/candidats', element: <RecruiterFeedRoute /> },
          { path: '/candidat/offres', element: <CandidateFeedRoute /> },
          { path: '/profil', element: <ProfileRoute /> },
        ],
      },
    ],
  },

  { path: '*', element: <HomeRedirect /> },
];

export const router = createBrowserRouter(routes);
