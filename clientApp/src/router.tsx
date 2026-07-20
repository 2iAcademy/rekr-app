import { createBrowserRouter, Navigate } from 'react-router';
import {
  SplashRoute,
  SignupRoute,
  SigninRoute,
  ForgotPasswordRoute,
} from '@/features/onboarding/routes';

export const router = createBrowserRouter([
  { path: '/', element: <SplashRoute /> },
  { path: '/inscription', element: <SignupRoute /> },
  { path: '/connexion', element: <SigninRoute /> },
  { path: '/mot-de-passe-oublie', element: <ForgotPasswordRoute /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
