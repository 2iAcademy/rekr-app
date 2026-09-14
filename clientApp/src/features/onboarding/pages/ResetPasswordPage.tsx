import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/form/PasswordInput';
import { authControllerResetPassword } from '@/api/generated';
import { ApiError } from '@/api/customFetch';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_RESET_SUCCESS,
  passwordResetBusiness,
} from '@/features/auth/authFeedback';
import { notifyFailure, notifySuccess } from '@/lib/feedback/notify';

interface ResetPasswordPageProps {
  token: string | null;
  onBack?: () => void;
  onSignIn?: () => void;
  onRequestNewLink?: () => void;
  onSuccess?: () => void;
}

/**
 * A token the server has turned down is as dead as one that never reached the
 * page, so both end on the same screen — only the wording differs, because a
 * visitor who just typed a password deserves to be told why it was not taken.
 */
type RejectedLink = 'missing' | 'refused';

const REJECTED_LINK_COPY: Record<RejectedLink, { heading: string; body: string }> = {
  missing: {
    heading: 'Lien invalide.',
    body: 'Ce lien est incomplet. Demandez-en un nouveau pour réinitialiser votre mot de passe.',
  },
  refused: {
    heading: 'Ce lien n’est plus valide.',
    body: 'Il a expiré ou a déjà servi. Demandez-en un nouveau pour réinitialiser votre mot de passe.',
  },
};

export function ResetPasswordPage({
  token,
  onBack,
  onSignIn,
  onRequestNewLink,
  onSuccess,
}: ResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [rejectedLink, setRejectedLink] = useState<RejectedLink | null>(
    token === null || token === '' ? 'missing' : null,
  );
  const rejectedHeadingRef = useRef<HTMLHeadingElement>(null);

  // Announce the dead-end to screen readers, and put the keyboard where the
  // only remaining action is.
  useEffect(() => {
    if (rejectedLink !== null) {
      rejectedHeadingRef.current?.focus();
    }
  }, [rejectedLink]);

  const clearError = () => setError(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (token === null || token === '') {
      setRejectedLink('missing');
      return;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`);
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    try {
      await authControllerResetPassword({ token, password });
      setError(null);
      notifySuccess(PASSWORD_RESET_SUCCESS);
      // No session is opened here: the server closed every one of them, so the
      // way back in is the login screen.
      onSuccess?.();
    } catch (caught) {
      // A 400 is the server's verdict on the link itself, not on what was
      // typed: the form has nothing left to offer, so the screen switches to
      // the dead-end and its way out.
      if (caught instanceof ApiError && caught.status === 400) {
        setRejectedLink('refused');
        return;
      }

      notifyFailure(caught, passwordResetBusiness);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-6 pt-4 pb-8">
      <header className="relative flex h-9 items-center justify-center">
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour"
          className="absolute left-0 flex size-9 cursor-pointer items-center justify-center rounded-full bg-card text-ink shadow-sm transition-colors hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="font-heading text-base font-bold text-ink">Nouveau mot de passe</h1>
      </header>

      {rejectedLink !== null ? (
        <div className="mt-10 flex flex-col gap-1.5" role="status">
          <h2
            ref={rejectedHeadingRef}
            tabIndex={-1}
            className="font-heading text-2xl font-bold text-ink outline-none"
          >
            {REJECTED_LINK_COPY[rejectedLink].heading}
          </h2>
          <p className="text-sm text-ink-muted">{REJECTED_LINK_COPY[rejectedLink].body}</p>
          <Button
            type="button"
            variant="role"
            size="xl"
            className="mt-6 w-full"
            onClick={onRequestNewLink}
          >
            Demander un nouveau lien
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-10 flex flex-col gap-1.5">
            <h2 className="font-heading text-2xl font-bold text-ink">Choisissez-en un nouveau.</h2>
            <p className="text-sm text-ink-muted">
              Il remplacera l'ancien et déconnectera vos autres appareils.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reset-password" className="text-xs text-ink-muted">
                Nouveau mot de passe
              </label>
              <PasswordInput
                id="reset-password"
                subject="le nouveau mot de passe"
                autoComplete="new-password"
                required
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearError();
                }}
                placeholder="8 caractères min."
                aria-invalid={error !== null}
                aria-describedby={error !== null ? 'reset-error' : undefined}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="reset-confirm-password" className="text-xs text-ink-muted">
                Confirmer le mot de passe
              </label>
              <PasswordInput
                id="reset-confirm-password"
                subject="la confirmation du mot de passe"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  clearError();
                }}
                placeholder="Ressaisissez le mot de passe"
                aria-invalid={error !== null}
                aria-describedby={error !== null ? 'reset-error' : undefined}
              />
            </div>

            {error && (
              <p id="reset-error" role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" variant="role" size="xl" className="mt-1 w-full">
              Réinitialiser le mot de passe
            </Button>
          </form>
        </>
      )}

      <p className="mt-8 flex items-center justify-center gap-1.5 text-sm text-ink-muted">
        Vous vous en souvenez ?
        <button
          type="button"
          onClick={onSignIn}
          className="cursor-pointer font-medium text-role-strong hover:underline"
        >
          Connexion
        </button>
      </p>
    </main>
  );
}
