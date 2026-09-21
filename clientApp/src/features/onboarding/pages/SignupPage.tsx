import { useState, type FormEvent } from 'react';
import { Building2, Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/form/PasswordInput';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/useAuth';
import { OptionCards, type Option } from '@/components/form/OptionCards';
import type { UserType } from '@/domain/userType';
import { SIGNUP_SUCCESS, signupBusiness } from '@/features/auth/authFeedback';
import { notifyFailure, notifySuccess } from '@/lib/feedback/notify';
import { AuthLayout } from '../components/AuthLayout';
import { AUTH_LABEL, AUTH_LINK } from '../components/authStyles';

// Typed as `UserType`: the selected value is sent as the account type, so a
// value the API does not know must not compile.
const roleOptions = [
  { value: 'candidate', label: 'Candidat', icon: Search },
  { value: 'recruiter', label: 'Recruteur', icon: Building2 },
] as const satisfies readonly Option<UserType>[];

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
      notifySuccess(SIGNUP_SUCCESS);
      onSubmit?.({ role, email, password });
    } catch (caught) {
      notifyFailure(caught, signupBusiness);
    }
  };

  return (
    <AuthLayout
      title="Créer un compte"
      onBack={onBack}
      footer={
        <>
          Déjà un compte ?
          <button type="button" onClick={onSignIn} className={AUTH_LINK}>
            Connexion
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl font-extrabold text-ink">Bienvenue sur Rekr.</h2>
        <p className="text-sm text-ink-muted">Quelques secondes, et vous pourrez commencer.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
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
          <label htmlFor="signup-email" className={AUTH_LABEL}>
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
          <label htmlFor="signup-password" className={AUTH_LABEL}>
            Mot de passe
          </label>
          <PasswordInput
            id="signup-password"
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
          <label htmlFor="signup-confirm-password" className={AUTH_LABEL}>
            Confirmer le mot de passe
          </label>
          <PasswordInput
            id="signup-confirm-password"
            subject="la confirmation du mot de passe"
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

        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(event) => {
              setAcceptTerms(event.target.checked);
              setError(null);
            }}
            className="peer sr-only"
          />
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md border border-input bg-card text-white transition-colors peer-checked:border-transparent peer-checked:bg-brand peer-focus-visible:ring-3 peer-focus-visible:ring-brand/30">
            <Check
              className={cn(
                'size-3.5 transition-opacity',
                acceptTerms ? 'opacity-100' : 'opacity-0',
              )}
            />
          </span>
          <span className="text-sm leading-snug text-ink-soft">
            J'accepte les CGU et la politique de confidentialité.
          </span>
        </label>

        {error && (
          <p
            id="signup-error"
            role="alert"
            className="rounded-xl bg-destructive-tint px-4 py-3 text-sm font-medium text-destructive"
          >
            {error}
          </p>
        )}

        <Button type="submit" variant="brand" size="xl" className="mt-1 w-full">
          Créer mon compte
        </Button>
      </form>
    </AuthLayout>
  );
}
