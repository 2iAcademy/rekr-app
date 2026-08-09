import { useState, type FormEvent } from 'react';
import { Check, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ApiError } from '@/api/customFetch';
import { useAuth } from '@/features/auth/useAuth';
import { OptionCards, type Option } from '@/components/form/OptionCards';
import type { RoleTheme } from '@/lib/roleTheme';

// Typed as `RoleTheme`: the selected value is fed straight to `data-role`, so a
// value without a matching palette scope must not compile.
const roleOptions = [
  { value: 'candidate', label: 'Candidat', description: 'Je cherche un poste' },
  { value: 'recruiter', label: 'Recruteur', description: 'Je recrute' },
] as const satisfies readonly Option<RoleTheme>[];

type Role = (typeof roleOptions)[number]['value'];

interface SignupPageProps {
  onBack?: () => void;
  onSignIn?: () => void;
  onSubmit?: (data: { role: Role; email: string; password: string }) => void;
}

export function SignupPage({ onBack, onSignIn, onSubmit }: SignupPageProps) {
  const { signup } = useAuth();
  const [role, setRole] = useState<Role>(roleOptions[0].value);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = password === confirmPassword;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!passwordsMatch) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    if (!acceptTerms) {
      setError('Vous devez accepter les CGU pour continuer.');
      return;
    }

    try {
      await signup(email, password, role);
      setError(null);
      onSubmit?.({ role, email, password });
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 409
          ? 'Un compte existe déjà pour cet email.'
          : 'Impossible de créer le compte.',
      );
    }
  };

  return (
    <main
      data-role={role}
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-6 pt-4 pb-8"
    >
      <header className="relative flex h-9 items-center justify-center">
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour"
          className="absolute left-0 flex size-9 cursor-pointer items-center justify-center rounded-full bg-card text-ink shadow-sm transition-colors hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="font-heading text-base font-bold text-ink">Créer un compte</h1>
      </header>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        {/* `Role` is pinned rather than inferred: a bare `setRole` offers
            `SetStateAction<Role>` as an inference candidate, which does not
            satisfy `T extends string`, so `T` collapses to `string`. */}
        <OptionCards<Role>
          legend="Je suis"
          name="role"
          options={roleOptions}
          value={role}
          onChange={setRole}
          columns={2}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="signup-email" className="text-xs text-ink-muted">
            Email
          </label>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nom@email.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="signup-password" className="text-xs text-ink-muted">
            Mot de passe
          </label>
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
            placeholder="8 caractères min."
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="signup-confirm-password" className="text-xs text-ink-muted">
            Confirmer le mot de passe
          </label>
          <Input
            id="signup-confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setError(null);
            }}
            placeholder="Ressaisissez le mot de passe"
            aria-invalid={error !== null && !passwordsMatch}
            aria-describedby={error !== null && !passwordsMatch ? 'signup-error' : undefined}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(event) => {
              setAcceptTerms(event.target.checked);
              setError(null);
            }}
            className="peer sr-only"
          />
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md border border-line bg-card text-white transition-colors peer-checked:border-transparent peer-checked:bg-role peer-focus-visible:ring-3 peer-focus-visible:ring-role/30">
            <Check
              className={cn(
                'size-3.5 transition-opacity',
                acceptTerms ? 'opacity-100' : 'opacity-0',
              )}
            />
          </span>
          <span className="text-xs leading-snug text-ink-muted">
            J'accepte les CGU et la politique de confidentialité.
          </span>
        </label>

        {error && (
          <p id="signup-error" role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" variant="role" size="xl" className="mt-1 w-full">
          Créer mon compte
        </Button>
      </form>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-sm text-ink-muted">
        Déjà un compte ?
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
