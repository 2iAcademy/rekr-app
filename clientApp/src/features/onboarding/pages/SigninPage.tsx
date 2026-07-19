import { useState, type FormEvent } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SigninPageProps {
  onBack?: () => void;
  onSignUp?: () => void;
  onSubmit?: (data: { email: string; password: string }) => void;
}

export function SigninPage({ onBack, onSignUp, onSubmit }: SigninPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit?.({ email, password });
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
        <h1 className="font-heading text-base font-bold text-ink">Connexion</h1>
      </header>

      <div className="mt-10 flex flex-col gap-1.5">
        <h2 className="font-heading text-2xl font-bold text-ink">Heureux de te revoir.</h2>
        <p className="text-sm text-ink-muted">Connecte-toi pour reprendre tes matches.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="signin-email" className="text-xs text-ink-muted">
            Email
          </label>
          <Input
            id="signin-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ton@email.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="signin-password" className="text-xs text-ink-muted">
            Mot de passe
          </label>
          <Input
            id="signin-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Ton mot de passe"
          />
        </div>

        <Button type="submit" variant="role" size="xl" className="mt-1 w-full">
          Se connecter
        </Button>
      </form>

      <div className="mt-8 flex items-center gap-4" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-ink-faint">ou</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-sm text-ink-muted">
        Pas encore de compte ?
        <button
          type="button"
          onClick={onSignUp}
          className="cursor-pointer font-medium text-role-strong hover:underline"
        >
          Inscription
        </button>
      </p>
    </main>
  );
}
