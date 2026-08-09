import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    setEmail(trimmedEmail);
    onSubmit?.({ email: trimmedEmail });
    setSubmitted(true);
  }

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
        <h1 className="font-heading text-base font-bold text-ink">Mot de passe oublié</h1>
      </header>

      {submitted ? (
        <div className="mt-10 flex flex-col gap-1.5" role="status">
          <h2
            ref={successHeadingRef}
            tabIndex={-1}
            className="font-heading text-2xl font-bold text-ink outline-none"
          >
            Email envoyé.
          </h2>
          <p className="text-sm text-ink-muted">
            Si un compte est associé à <span className="font-medium text-ink">{email}</span>, vous
            recevez un lien pour réinitialiser votre mot de passe. Pensez à vérifier vos spams.
          </p>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="mt-4 cursor-pointer self-start text-sm font-medium text-role-strong hover:underline"
          >
            Modifier l'email
          </button>
        </div>
      ) : (
        <>
          <div className="mt-10 flex flex-col gap-1.5">
            <h2 className="font-heading text-2xl font-bold text-ink">Pas de panique.</h2>
            <p className="text-sm text-ink-muted">
              Saisissez votre email, on vous envoie un lien pour le réinitialiser.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="forgot-email" className="text-xs text-ink-muted">
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

            <Button type="submit" variant="role" size="xl" className="mt-1 w-full">
              Envoyer le lien
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
