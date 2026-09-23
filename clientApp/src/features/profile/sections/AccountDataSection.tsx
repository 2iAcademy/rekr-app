import { useState, type FormEvent } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { accountControllerDelete, accountControllerExport } from '@/api/generated';
import { ApiError } from '@/api/customFetch';
import { PasswordInput } from '@/components/form/PasswordInput';
import { Button } from '@/components/ui/button';
import { SectionTitle } from '@/components/ui/section-title';
import { useAuth } from '@/features/auth/useAuth';
import {
  ACCOUNT_DELETE_SUCCESS,
  ACCOUNT_DELETE_WRONG_PASSWORD,
  ACCOUNT_EXPORT_SUCCESS,
  accountDeleteBusiness,
  accountExportBusiness,
} from '@/features/profile/accountFeedback';
import { notifyFailure, notifySuccess } from '@/lib/feedback/notify';

/**
 * Hands the export to the browser as a file. The API already answers with an
 * attachment, but the request carries a bearer token, so it cannot be a plain
 * link: the body is fetched, then saved from a blob URL.
 */
const saveAsFile = (data: unknown) => {
  const exportedAt = (data as { exportedAt?: unknown }).exportedAt;
  const day = typeof exportedAt === 'string' ? exportedAt.slice(0, 10) : 'donnees';
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `rekr-export-${day}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

/**
 * The two rights the account screen exercises for every user type: a copy of
 * one's data, and leaving for good. Deletion takes two steps and the password,
 * since nothing can bring the account back.
 */
export function AccountDataSection() {
  const { accountDeleted } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [wrongPassword, setWrongPassword] = useState(false);

  const download = async () => {
    setExporting(true);
    try {
      const res = await accountControllerExport();
      saveAsFile(res.data);
      notifySuccess(ACCOUNT_EXPORT_SUCCESS);
    } catch (caught) {
      notifyFailure(caught, accountExportBusiness);
    } finally {
      setExporting(false);
    }
  };

  const cancel = () => {
    setConfirming(false);
    setPassword('');
    setWrongPassword(false);
  };

  const erase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDeleting(true);
    setWrongPassword(false);

    try {
      await accountControllerDelete({ password });
    } catch (caught) {
      setDeleting(false);
      if (caught instanceof ApiError && caught.status === 403) {
        setWrongPassword(true);
        return;
      }
      notifyFailure(caught, accountDeleteBusiness);
      return;
    }

    // No reset of the local state: forgetting the session unmounts the screen,
    // and the shell guard sends the visitor to the login form.
    notifySuccess(ACCOUNT_DELETE_SUCCESS);
    accountDeleted();
  };

  return (
    <section aria-labelledby="account-data-title" className="mt-10 flex flex-col gap-4">
      <SectionTitle id="account-data-title">Mes données</SectionTitle>

      <div className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-card p-5">
        <p className="text-sm text-ink-soft">
          Téléchargez une copie de tout ce que Rekr conserve sur vous, au format JSON.
        </p>
        <Button variant="outline" disabled={exporting} onClick={() => void download()}>
          <Download aria-hidden="true" className="size-4" />
          Télécharger mes données
        </Button>
      </div>

      <div className="flex flex-col items-start gap-3 rounded-2xl border border-destructive/30 bg-card p-5">
        {!confirming ? (
          <>
            <p className="text-sm text-ink-soft">
              Supprimez votre compte et toutes les données qui y sont rattachées.
            </p>
            <Button variant="destructive" onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden="true" className="size-4" />
              Supprimer mon compte
            </Button>
          </>
        ) : (
          <form onSubmit={(event) => void erase(event)} className="flex w-full flex-col gap-3">
            <p className="text-sm text-ink">
              La suppression est définitive : votre profil, vos fichiers, vos likes et vos matchs
              seront effacés. Saisissez votre mot de passe pour confirmer.
            </p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="account-delete-password" className="text-xs text-ink-muted">
                Mot de passe
              </label>
              <PasswordInput
                id="account-delete-password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setWrongPassword(false);
                }}
                aria-invalid={wrongPassword}
                aria-describedby={wrongPassword ? 'account-delete-error' : undefined}
              />
              {wrongPassword && (
                <p id="account-delete-error" role="alert" className="text-xs text-destructive">
                  {ACCOUNT_DELETE_WRONG_PASSWORD}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="destructive" disabled={deleting}>
                Supprimer définitivement
              </Button>
              <Button type="button" variant="ghost" disabled={deleting} onClick={cancel}>
                Annuler
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
