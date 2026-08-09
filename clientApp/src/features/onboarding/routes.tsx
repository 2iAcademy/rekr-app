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
  return (
    <SignupPage
      onBack={() => navigate('/')}
      onSignIn={() => navigate('/connexion')}
      onSubmit={({ role }) => {
        // Only the recruiter journey exists so far; a candidate stays put rather
        // than being sent to the anonymous splash.
        if (role === 'recruiter') {
          navigate('/recruteur/profil');
        }
      }}
    />
  );
}

export function SigninRoute() {
  const navigate = useNavigate();
  return (
    <SigninPage
      onBack={() => navigate('/')}
      onSignUp={() => navigate('/inscription')}
      onForgotPassword={() => navigate('/mot-de-passe-oublie')}
      onSubmit={() => navigate('/')}
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
