import { createBrowserRouter, Navigate } from 'react-router';
import { AppDrawer } from '@/components/layout/AppDrawer';
import { CandidateOnboardingRoute } from '@/features/candidate-onboarding/routes';
import { MatchesRoute } from '@/features/matches/routes';
import {
  ForgotPasswordRoute,
  SigninRoute,
  SignupRoute,
  SplashRoute,
} from '@/features/onboarding/routes';
import { OfferDetailRoute } from '@/features/offers/routes';
import { MatchRoute } from '@/features/matches/routes';
import { ProfileRoute } from '@/features/profile/routes';
import { RecruiterOnboardingRoute } from '@/features/recruiter-onboarding/routes';

export const routes = [
  { path: '/', element: <SplashRoute /> },
  { path: '/inscription', element: <SignupRoute /> },
  { path: '/connexion', element: <SigninRoute /> },
  { path: '/mot-de-passe-oublie', element: <ForgotPasswordRoute /> },
  { path: '/profil', element: <ProfileRoute /> },
  { path: '/offres/:id', element: <OfferDetailRoute /> },
  {
    element: <AppDrawer />,
    children: [{ path: '/matches', element: <MatchesRoute /> }],
  },
  { path: '/match', element: <MatchRoute /> },
  { path: '/candidat/profil', element: <CandidateOnboardingRoute /> },
  { path: '/recruteur/profil', element: <RecruiterOnboardingRoute /> },
  { path: '*', element: <Navigate to="/" replace /> },
];

export const router = createBrowserRouter(routes);
