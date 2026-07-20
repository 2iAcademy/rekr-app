import { useNavigate } from 'react-router';
import { SplashPage } from '@/features/onboarding/pages/SplashPage';
import { SignupPage } from '@/features/onboarding/pages/SignupPage';
import { SigninPage } from '@/features/onboarding/pages/SigninPage';
import { ForgotPasswordPage } from '@/features/onboarding/pages/ForgotPasswordPage';

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

export function SigninRoute() {
  const navigate = useNavigate();
  return (
    <SigninPage
      onBack={() => navigate('/')}
      onSignUp={() => navigate('/inscription')}
      onForgotPassword={() => navigate('/mot-de-passe-oublie')}
    />
  );
}

export function ForgotPasswordRoute() {
  const navigate = useNavigate();
  return (
    <ForgotPasswordPage
      onBack={() => navigate('/connexion')}
      onSignIn={() => navigate('/connexion')}
    />
  );
}
