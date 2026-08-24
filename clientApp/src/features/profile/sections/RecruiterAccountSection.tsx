import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ApiError } from '@/api/customFetch';
import {
  companyControllerFindMine,
  companyControllerRemoveCoverImage,
  companyControllerRemoveLogo,
  companyControllerReplaceCoverImage,
  companyControllerReplaceLogo,
  companyControllerUpdateMine,
} from '@/api/generated';
import { CityField } from '@/components/form/CityField';
import { FileField } from '@/components/form/FileField';
import { FILE_CONSTRAINTS } from '@/components/form/fileConstraints';
import { OptionCards } from '@/components/form/OptionCards';
import { RichTextField } from '@/components/form/RichTextField';
import { TagInput } from '@/components/form/TagInput';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { COMPANY_SIZE_OPTIONS } from '@/domain/options';
import {
  FILE_REMOVE_SUCCESS,
  FILE_REPLACE_SUCCESS,
  fileRemoveBusiness,
  fileReplaceBusiness,
  PROFILE_UPDATE_SUCCESS,
  profileUpdateBusiness,
} from '@/features/profile/accountFeedback';
import {
  buildAccountPayload,
  emptyRecruiterAccountForm,
  firstInvalidField,
  formFromCompany,
  readFileKey,
  type RecruiterAccountField,
  type RecruiterAccountForm,
} from '@/features/profile/recruiterCompany';
import { SectorField } from '@/features/recruiter-onboarding/components/SectorField';
import { MAX_FREE_TEXT_LENGTH } from '@/lib/bounds';
import type { BusinessMessages } from '@/lib/feedback/failureMessage';
import { notifyFailure, notifySuccess } from '@/lib/feedback/notify';
import { fileUrl } from '@/lib/fileUrl';
import { cn } from '@/lib/utils';

type Status = 'loading' | 'ready' | 'absent' | 'failed';

type FileSlot = 'logo' | 'coverImage';

const LOGO_LABEL = 'Logo de la société';
const COVER_LABEL = 'Image de couverture';

const noFiles: Readonly<Record<FileSlot, string | null>> = { logo: null, coverImage: null };
const noBusy: Readonly<Record<FileSlot, boolean>> = { logo: false, coverImage: false };

interface Invalid {
  field: RecruiterAccountField;
  message: string;
}

/**
 * The recruiter half of « Mon compte ». It loads its own data, so the page that
 * mounts it never has to know which role it is showing.
 *
 * The text fields are saved together, by the form's own button; the two images
 * each have their own endpoint and are written the moment one is picked. Their
 * feedback is separate for the same reason.
 */
export function RecruiterAccountSection() {
  const errorId = useId();
  const [status, setStatus] = useState<Status>('loading');
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<RecruiterAccountForm>(emptyRecruiterAccountForm);
  const [files, setFiles] = useState<Record<FileSlot, string | null>>(noFiles);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<Record<FileSlot, boolean>>(noBusy);
  const [invalid, setInvalid] = useState<Invalid | null>(null);

  useEffect(() => {
    let cancelled = false;

    void companyControllerFindMine()
      .then((response) => {
        if (cancelled) {
          return;
        }

        const company = response.data;
        setForm(formFromCompany(company));
        setFiles({ logo: company.logo, coverImage: company.coverImage });
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (cancelled) {
          return;
        }

        // A recruiter who skipped the wizard has no company row at all. That is
        // not a failure to retry, it is a form still to fill in.
        setStatus(cause instanceof ApiError && cause.status === 404 ? 'absent' : 'failed');
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // `status` is reset here rather than in the effect: setting state in an
  // effect body cascades a render, and the retry is the event that starts the
  // reload anyway.
  const reload = (): void => {
    setStatus('loading');
    setAttempt((current) => current + 1);
  };

  const patch = (fields: Partial<RecruiterAccountForm>): void =>
    setForm((current) => ({ ...current, ...fields }));

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();

    const failure = firstInvalidField(form);
    setInvalid(failure);
    if (failure !== null) {
      return;
    }

    setSaving(true);

    try {
      await companyControllerUpdateMine(buildAccountPayload(form));
      // Nothing to adopt from the answer: it carries the `company` row alone —
      // no recruiter, no benefits — and every column it reports is one this
      // form has just sent. Reading it back would only risk losing the identity
      // half it does not return.
      notifySuccess(PROFILE_UPDATE_SUCCESS);
    } catch (cause) {
      notifyFailure(cause, profileUpdateBusiness);
    } finally {
      setSaving(false);
    }
  };

  const write = async (
    slot: FileSlot,
    request: () => Promise<{ data: unknown }>,
    success: string,
    business: BusinessMessages,
  ): Promise<void> => {
    setBusy((current) => ({ ...current, [slot]: true }));

    try {
      const response = await request();
      // Each write mints a fresh key and the previous file is deleted, so the
      // answer is the only thing that still points at a readable file.
      setFiles((current) => ({ ...current, [slot]: readFileKey(response.data, slot) }));
      notifySuccess(success);
    } catch (cause) {
      notifyFailure(cause, business);
    } finally {
      setBusy((current) => ({ ...current, [slot]: false }));
    }
  };

  const replace = (slot: FileSlot, file: File): void =>
    void write(
      slot,
      () =>
        slot === 'logo'
          ? companyControllerReplaceLogo({ file })
          : companyControllerReplaceCoverImage({ file }),
      FILE_REPLACE_SUCCESS,
      fileReplaceBusiness,
    );

  const drop = (slot: FileSlot): void =>
    void write(
      slot,
      () => (slot === 'logo' ? companyControllerRemoveLogo() : companyControllerRemoveCoverImage()),
      FILE_REMOVE_SUCCESS,
      fileRemoveBusiness,
    );

  const mark = (field: RecruiterAccountField) => ({
    'aria-invalid': invalid?.field === field,
    'aria-describedby': invalid?.field === field ? errorId : undefined,
  });

  if (status === 'loading') {
    return (
      <p role="status" className="mt-6 text-sm text-ink-muted">
        Chargement de vos informations…
      </p>
    );
  }

  if (status === 'failed') {
    return (
      <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-line bg-card p-5">
        <p role="alert" className="text-sm text-destructive">
          Impossible de charger les informations de votre société.
        </p>
        <Button variant="soft" size="lg" onClick={reload}>
          Réessayer
        </Button>
      </div>
    );
  }

  if (status === 'absent') {
    return (
      <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-line bg-card p-5">
        <p className="text-sm text-ink">Vous n’avez pas encore renseigné votre société.</p>
        <Link
          to="/recruteur/profil"
          className={cn(buttonVariants({ variant: 'role', size: 'lg' }))}
        >
          Compléter ma fiche société
        </Link>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={(event) => void submit(event)} className="mt-8 flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-base font-semibold text-ink">Mon identité</h2>
          <p className="text-sm text-ink-muted">
            Ces informations n’apparaissent aux candidats qu’après un match.
          </p>

          <TextField
            label="Prénom"
            aria-required
            {...mark('firstName')}
            autoComplete="given-name"
            maxLength={100}
            value={form.firstName}
            onChange={(event) => patch({ firstName: event.target.value })}
          />

          <TextField
            label="Nom"
            aria-required
            {...mark('lastName')}
            autoComplete="family-name"
            maxLength={100}
            value={form.lastName}
            onChange={(event) => patch({ lastName: event.target.value })}
          />

          <TextField
            label="Poste / fonction"
            autoComplete="organization-title"
            maxLength={150}
            value={form.jobTitle}
            onChange={(event) => patch({ jobTitle: event.target.value })}
          />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-base font-semibold text-ink">Ma société</h2>

          <TextField
            label="Nom de la société"
            aria-required
            {...mark('name')}
            autoComplete="organization"
            maxLength={255}
            value={form.name}
            onChange={(event) => patch({ name: event.target.value })}
          />

          <SectorField value={form.sectorId} onChange={(sectorId) => patch({ sectorId })} />

          <OptionCards
            legend="Taille"
            name="company-size"
            options={COMPANY_SIZE_OPTIONS}
            value={form.size}
            onChange={(size) => patch({ size })}
            columns={2}
          />

          <CityField
            label="Ville"
            selected={
              form.city && form.postalCode ? { name: form.city, postalCode: form.postalCode } : null
            }
            onSelect={(city) => patch({ city: city.name, postalCode: city.postalCode })}
            onClear={() => patch({ city: '', postalCode: '' })}
            invalid={invalid?.field === 'city'}
            describedBy={invalid?.field === 'city' ? errorId : undefined}
          />

          <TextField
            label="Site web (optionnel)"
            type="url"
            autoComplete="url"
            maxLength={255}
            value={form.siteUrl}
            onChange={(event) => patch({ siteUrl: event.target.value })}
          />

          <RichTextField
            label="Présentation de la société"
            maxLength={MAX_FREE_TEXT_LENGTH}
            value={form.description}
            onChange={(description) => patch({ description })}
          />

          <TagInput
            label="Avantages (optionnel)"
            placeholder="Mutuelle, tickets resto, RTT…"
            values={form.benefits}
            onChange={(benefits) => patch({ benefits })}
          />
        </section>

        {invalid !== null && (
          <p id={errorId} role="alert" className="text-xs text-destructive">
            {invalid.message}
          </p>
        )}

        <div className="flex justify-start">
          <Button type="submit" variant="role" size="xl" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </form>

      <section className="mt-10 flex flex-col gap-5 border-t border-line pt-8">
        <h2 className="font-heading text-base font-semibold text-ink">Images de la société</h2>
        <p className="text-sm text-ink-muted">
          Ces images sont celles de la société : elles sont partagées avec les autres recruteurs de
          votre société. Chaque envoi est enregistré aussitôt.
        </p>

        <FileField
          label={LOGO_LABEL}
          constraint={FILE_CONSTRAINTS.logo}
          previewUrl={fileUrl(files.logo)}
          presentLabel="Logo enregistré"
          emptyLabel="Aucun logo"
          busy={busy.logo}
          onSelect={(file) => replace('logo', file)}
          onRemove={() => drop('logo')}
        />

        <FileField
          label={COVER_LABEL}
          constraint={FILE_CONSTRAINTS.coverImage}
          previewUrl={fileUrl(files.coverImage)}
          presentLabel="Image enregistrée"
          emptyLabel="Aucune image de couverture"
          busy={busy.coverImage}
          onSelect={(file) => replace('coverImage', file)}
          onRemove={() => drop('coverImage')}
        />
      </section>
    </>
  );
}
