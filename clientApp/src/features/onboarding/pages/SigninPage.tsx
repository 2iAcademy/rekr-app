import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/form/PasswordInput';
import { useAuth } from '@/features/auth/useAuth';
import { LOGIN_SUCCESS, loginBusiness } from '@/features/auth/authFeedback';
import { notifyFailure, notifySuccess } from '@/lib/feedback/notify';
import { AuthLayout } from '../components/AuthLayout';
import { AUTH_LABEL, AUTH_LINK } from '../components/authStyles';

interface SigninPageProps {
  onBack?: () => void;
  onSignUp?: () => void;
  onForgotPassword?: () => void;
  onSubmit?: (data: { email: string; password: string }) => void;
}

export function SigninPage({ onBack, onSignUp, onForgotPassword, onSubmit }: SigninPageProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await login(email, password);
      notifySuccess(LOGIN_SUCCESS);
      onSubmit?.({ email, password });
    } catch (caught) {
      notifyFailure(caught, loginBusiness);
    }
  };
  return (
    <AuthLayout
      title="Connexion"
      onBack={onBack}
      footer={
        <>
          Pas encore de compte ?
          <button type="button" onClick={onSignUp} className={AUTH_LINK}>
            Inscription
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl font-extrabold text-ink">Heureux de vous revoir.</h2>
        <p className="text-sm text-ink-muted">Connectez-vous pour reprendre vos matches.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="signin-email" className={AUTH_LABEL}>
            Email
          </label>
          <Input
            id="signin-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nom@email.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="signin-password" className={AUTH_LABEL}>
            Mot de passe
          </label>
          <PasswordInput
            id="signin-password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Votre mot de passe"
          />
          <button
            type="button"
            onClick={onForgotPassword}
            className={`${AUTH_LINK} -mb-2 self-end text-xs`}
          >
            Mot de passe oublié ?
          </button>
        </div>

        <Button type="submit" variant="brand" size="xl" className="mt-1 w-full">
          Se connecter
        </Button>
      </form>
    </AuthLayout>
  );
}
