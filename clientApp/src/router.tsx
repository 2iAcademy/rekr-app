import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
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
import { RecruiterOnboardingRoute } from '@/features/recruiter-onboarding/routes';

export const routes = [
  { path: '/', element: <SplashRoute /> },
  { path: '/inscription', element: <SignupRoute /> },
  { path: '/connexion', element: <SigninRoute /> },
  { path: '/mot-de-passe-oublie', element: <ForgotPasswordRoute /> },
  { path: '/offres/:id', element: <OfferDetailRoute /> },
  {
    element: <AppShell />,
    children: [
      { path: '/matches', element: <MatchesRoute /> },
      { path: '/recruteur/candidats', element: <RecruiterFeedRoute /> },
      { path: '/candidat/offres', element: <CandidateFeedRoute /> },
      { path: '/profil', element: <ProfileRoute /> },
    ],
  },
  { path: '/match', element: <MatchRoute /> },
  { path: '/candidat/profil', element: <CandidateOnboardingRoute /> },
  { path: '/recruteur/profil', element: <RecruiterOnboardingRoute /> },
  { path: '*', element: <Navigate to="/" replace /> },
];

export const router = createBrowserRouter(routes);
