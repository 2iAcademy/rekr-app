import { Navigate } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';

export function ProfileRoute() {
  const { status } = useAuth();

  if (status === 'loading') {
    return null;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/connexion" replace />;
  }
  //To be developed in the future, for now we redirect to matches page
  return <Navigate to={'/matches'} replace />;
}
