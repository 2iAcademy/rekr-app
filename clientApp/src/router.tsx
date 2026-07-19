import { createBrowserRouter, Navigate } from 'react-router';
import { SplashRoute, SignupRoute } from '@/features/onboarding/routes';

export const router = createBrowserRouter([
  { path: '/', element: <SplashRoute /> },
  { path: '/inscription', element: <SignupRoute /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
