import { createBrowserRouter, Navigate } from 'react-router';
import {
  SplashRoute,
  SignupRoute,
  SigninRoute,
  ForgotPasswordRoute,
} from '@/features/onboarding/routes';
import { RecruiterOnboardingRoute } from '@/features/recruiter-onboarding/routes';

export const routes = [
  { path: '/', element: <SplashRoute /> },
  { path: '/inscription', element: <SignupRoute /> },
  { path: '/connexion', element: <SigninRoute /> },
  { path: '/mot-de-passe-oublie', element: <ForgotPasswordRoute /> },
  { path: '/recruteur/profil', element: <RecruiterOnboardingRoute /> },
  { path: '*', element: <Navigate to="/" replace /> },
];

export const router = createBrowserRouter(routes);
