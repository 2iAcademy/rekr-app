import { useNavigate, useSearchParams } from 'react-router';
import { SplashPage } from '@/features/onboarding/pages/SplashPage';
import { SignupPage } from '@/features/onboarding/pages/SignupPage';
import { SigninPage } from '@/features/onboarding/pages/SigninPage';
import { ForgotPasswordPage } from '@/features/onboarding/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/onboarding/pages/ResetPasswordPage';

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

export function ResetPasswordRoute() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /*
   * Replaced, not pushed: the reset link is single-use, so the entry it would
   * leave in the history only leads back to a token the server has already
   * burnt.
   */
  return (
    <ResetPasswordPage
      token={searchParams.get('token')}
      onBack={() => navigate('/connexion')}
      onSignIn={() => navigate('/connexion')}
      onRequestNewLink={() => navigate('/mot-de-passe-oublie', { replace: true })}
      onSuccess={() => navigate('/connexion', { replace: true })}
    />
  );
}
