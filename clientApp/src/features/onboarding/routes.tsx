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

  /*
   * No navigation on success: creating the account settles the session, and the
   * `AnonymousOnly` layout above sends it wherever it belongs — the matching
   * wizard for a brand-new account. Steering from here would mean deciding the
   * destination from the radio button rather than from what the server answered.
   */
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
