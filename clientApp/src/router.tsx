import { createBrowserRouter, Navigate } from 'react-router';
import {
  SplashRoute,
  SignupRoute,
  SigninRoute,
  ForgotPasswordRoute,
} from '@/features/onboarding/routes';
import { CandidateOnboardingRoute } from '@/features/candidate-onboarding/routes';
import { OfferDetailRoute } from '@/features/offers/routes';
import { RecruiterOnboardingRoute } from '@/features/recruiter-onboarding/routes';

export const routes = [
  { path: '/', element: <SplashRoute /> },
  { path: '/inscription', element: <SignupRoute /> },
  { path: '/connexion', element: <SigninRoute /> },
  { path: '/mot-de-passe-oublie', element: <ForgotPasswordRoute /> },
  { path: '/offres/:id', element: <OfferDetailRoute /> },
  { path: '/candidat/profil', element: <CandidateOnboardingRoute /> },
  { path: '/recruteur/profil', element: <RecruiterOnboardingRoute /> },
  { path: '*', element: <Navigate to="/" replace /> },
];

export const router = createBrowserRouter(routes);
