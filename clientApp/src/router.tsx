import { createBrowserRouter, Navigate } from 'react-router';
import { SplashRoute, SignupRoute, SigninRoute } from '@/features/onboarding/routes';

export const router = createBrowserRouter([
  { path: '/', element: <SplashRoute /> },
  { path: '/inscription', element: <SignupRoute /> },
  { path: '/connexion', element: <SigninRoute /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
