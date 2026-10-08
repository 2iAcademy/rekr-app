import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authControllerForgotPassword } from '@/api/generated';
import { ApiError } from '@/api/customFetch';
import { passwordForgotBusiness } from '@/features/auth/authFeedback';
import { notifyFailure } from '@/lib/feedback/notify';
import { AuthLayout } from '../components/AuthLayout';
import { AUTH_LABEL, AUTH_LINK } from '../components/authStyles';

/**
 * The endpoint answers 204 for an unknown address, an inactive account and a
 * mail that could not be sent — the whole point being that none of them is
 * distinguishable from a delivered link, so all of them land on the
 * confirmation screen unchanged. What must not is a request the server never
 * answered on its merits (outage, throttle) and a payload it rejected outright:
 * a 400 means nothing was sent, and announcing a delivery would leave the user
 * waiting for a mail that will never come. Neither wording says anything about
 * the address existing.
 */
const blocksConfirmation = (cause: unknown): boolean =>
  !(cause instanceof ApiError) ||
  cause.status === 400 ||
  cause.status === 429 ||
  cause.status >= 500;

interface ForgotPasswordPageProps {
  onBack?: () => void;
  onSignIn?: () => void;
  onSubmit?: (data: { email: string }) => void;
}

export function ForgotPasswordPage({ onBack, onSignIn, onSubmit }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

  // Announce the success state to screen readers on transition.
  useEffect(() => {
    if (submitted) {
      successHeadingRef.current?.focus();
    }
  }, [submitted]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // ForgotPasswordDto normalizes the address server-side; doing it again here
    // would only rewrite what the user sees for no gain.
    try {
      await authControllerForgotPassword({ email });
    } catch (caught) {
      if (blocksConfirmation(caught)) {
        notifyFailure(caught, passwordForgotBusiness);
        return;
      }
    }

    onSubmit?.({ email });
    setSubmitted(true);
  };

  return (
    <AuthLayout
      title="Mot de passe oublié"
      onBack={onBack}
      footer={
        <>
          Vous vous en souvenez ?
          <button type="button" onClick={onSignIn} className={AUTH_LINK}>
            Connexion
          </button>
        </>
      }
    >
      {submitted ? (
        <div className="flex flex-col gap-1.5" role="status">
          <span
            aria-hidden="true"
            className="mb-3 flex size-14 items-center justify-center rounded-full bg-brand-tint text-brand"
          >
            <MailCheck className="size-6" />
          </span>
          <h2
            ref={successHeadingRef}
            tabIndex={-1}
            className="text-2xl font-extrabold text-ink outline-none"
          >
            Email envoyé.
          </h2>
          <p className="text-sm leading-relaxed text-ink-muted">
            Si un compte est associé à <span className="font-semibold text-ink">{email}</span>, vous
            recevez un lien pour réinitialiser votre mot de passe. Pensez à vérifier vos spams.
          </p>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className={`${AUTH_LINK} mt-2 self-start text-sm`}
          >
            Modifier l'email
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-extrabold text-ink">Pas de panique.</h2>
            <p className="text-sm text-ink-muted">
              Saisissez votre email, on vous envoie un lien pour le réinitialiser.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="forgot-email" className={AUTH_LABEL}>
                Email
              </label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nom@email.com"
              />
            </div>

            <Button type="submit" variant="brand" size="xl" className="mt-1 w-full">
              Envoyer le lien
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
