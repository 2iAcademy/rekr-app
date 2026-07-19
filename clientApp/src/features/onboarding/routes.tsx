import { useNavigate } from 'react-router';
import { SplashPage } from '@/features/onboarding/pages/SplashPage';
import { SignupPage } from '@/features/onboarding/pages/SignupPage';

export function SplashRoute() {
  const navigate = useNavigate();
  return (
    <SplashPage
      onCreateAccount={() => navigate('/inscription')}
      onSignIn={() => navigate('/connexion')}
    />
  );
}

export function SignupRoute() {
  const navigate = useNavigate();
  return <SignupPage onBack={() => navigate('/')} onSignIn={() => navigate('/connexion')} />;
}
