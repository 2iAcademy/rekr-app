import { useEffect, useId, useState, type FormEvent } from 'react';
import { ApiError } from '@/api/customFetch';
import {
  candidateProfileControllerFindMine,
  candidateProfileControllerRemoveCv,
  candidateProfileControllerRemovePicture,
  candidateProfileControllerReplaceCv,
  candidateProfileControllerReplacePicture,
  candidateProfileControllerUpdate,
} from '@/api/generated';
import { CityField } from '@/components/form/CityField';
import { FileField } from '@/components/form/FileField';
import { FILE_CONSTRAINTS } from '@/components/form/fileConstraints';
import { OptionCards } from '@/components/form/OptionCards';
import { OptionChips } from '@/components/form/OptionChips';
import { RichTextField } from '@/components/form/RichTextField';
import { SalaryRange } from '@/components/form/SalaryRange';
import { TagInput } from '@/components/form/TagInput';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import {
  AVAILABILITY_OPTIONS,
  CONTRACT_TYPE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  REMOTE_POLICY_OPTIONS,
} from '@/domain/options';
import {
  FILE_REMOVE_SUCCESS,
  FILE_REPLACE_SUCCESS,
  fileRemoveBusiness,
  fileReplaceBusiness,
  PROFILE_UPDATE_SUCCESS,
  profileUpdateBusiness,
} from '@/features/profile/accountFeedback';
import { MAX_FREE_TEXT_LENGTH } from '@/lib/bounds';
import type { BusinessMessages } from '@/lib/feedback/failureMessage';
import { notifyFailure, notifySuccess } from '@/lib/feedback/notify';
import { fileUrl } from '@/lib/fileUrl';
import { digitsOnly } from '@/lib/numbers';
import {
  buildCandidateAccountPayload,
  firstInvalidCandidateField,
  MOBILITY_SCOPE_OPTIONS,
  toCandidateAccountForm,
  type CandidateAccountForm,
  type CandidateAccountInvalidField,
} from '../candidateAccountForm';

const PICTURE_LABEL = 'Photo de profil';
const CV_LABEL = 'CV';

const LOAD_FAILURE = 'Impossible de charger vos informations. Rechargez la page pour réessayer.';

type FileSlot = 'picture' | 'cv';

interface StoredFiles {
  picture: string | null;
  cvUrl: string | null;
}

/**
 * `absent` is the 404: a candidate who signed up and skipped the wizard has an
 * account but no `candidate_profile` row, and there is nothing here to edit until
 * one exists. It is a legitimate state, not a failure.
 */
type SectionState =
  | { status: 'loading' }
  | { status: 'absent' }
  | { status: 'failed' }
  | ({ status: 'ready'; form: CandidateAccountForm } & StoredFiles);

/**
 * The file endpoints answer with the updated row, but orval types their response
 * `void` — the Nest handlers carry no `@ApiOkResponse`. Reading the column back
 * is what keeps the picture visible: every replacement mints a fresh key and the
 * previous one is dead, so keeping the old value would show a broken image.
 * An unreadable body reads as « no file »: a slot that looks empty is recovered
 * by a reload, a slot pointing at a dead key never is.
 */
const storedKey = (body: unknown, column: keyof StoredFiles): string | null => {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const value = (body as Record<string, unknown>)[column];

  return typeof value === 'string' ? value : null;
};

export function CandidateAccountSection() {
  const errorId = useId();
  const headingId = useId();
  const [state, setState] = useState<SectionState>({ status: 'loading' });
  const [invalid, setInvalid] = useState<CandidateAccountInvalidField | null>(null);
  const [saving, setSaving] = useState(false);
  // One flag per slot: the picture and the CV are two independent uploads, and a
  // shared boolean would grey out the one the candidate is not touching.
  const [busy, setBusy] = useState({ picture: false, cv: false });

  useEffect(() => {
    let abandoned = false;

    candidateProfileControllerFindMine()
      .then((response) => {
        if (abandoned) {
          return;
        }

        setState({
          status: 'ready',
          form: toCandidateAccountForm(response.data),
          picture: response.data.picture,
          cvUrl: response.data.cvUrl,
        });
      })
      .catch((caught: unknown) => {
        if (abandoned) {
          return;
        }

        const missing = caught instanceof ApiError && caught.status === 404;
        setState({ status: missing ? 'absent' : 'failed' });
      });

    return () => {
      abandoned = true;
    };
  }, []);

  const change = (patch: Partial<CandidateAccountForm>): void => {
    setInvalid(null);
    setState((current) =>
      current.status === 'ready' ? { ...current, form: { ...current.form, ...patch } } : current,
    );
  };

  const save = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (state.status !== 'ready' || saving) {
      return;
    }

    const refused = firstInvalidCandidateField(state.form);
    if (refused) {
      setInvalid(refused);
      return;
    }

    setInvalid(null);
    setSaving(true);

    try {
      await candidateProfileControllerUpdate(buildCandidateAccountPayload(state.form));
      notifySuccess(PROFILE_UPDATE_SUCCESS);
    } catch (caught) {
      notifyFailure(caught, profileUpdateBusiness);
    } finally {
      setSaving(false);
    }
  };

  const writeFile = async (
    slot: FileSlot,
    request: () => Promise<{ data: unknown }>,
    success: string,
    business: BusinessMessages,
  ): Promise<void> => {
    if (busy[slot]) {
      return;
    }

    setBusy((current) => ({ ...current, [slot]: true }));

    try {
      const response = await request();
      const column: keyof StoredFiles = slot === 'picture' ? 'picture' : 'cvUrl';
      const key = storedKey(response.data, column);

      setState((current) => {
        if (current.status !== 'ready') {
          return current;
        }

        return slot === 'picture' ? { ...current, picture: key } : { ...current, cvUrl: key };
      });
      notifySuccess(success);
    } catch (caught) {
      notifyFailure(caught, business);
    } finally {
      setBusy((current) => ({ ...current, [slot]: false }));
    }
  };

  if (state.status === 'loading') {
    return (
      <p role="status" className="mt-8 text-sm text-ink-muted">
        Chargement de vos informations…
      </p>
    );
  }

  if (state.status === 'failed') {
    return (
      <p role="alert" className="mt-8 text-sm text-destructive">
        {LOAD_FAILURE}
      </p>
    );
  }

  if (state.status === 'absent') {
    return (
      <section className="mt-8 flex flex-col items-start gap-4 rounded-2xl border border-line bg-card p-5">
        <p className="text-sm text-ink-soft">
          Vous n’avez pas encore de profil candidat. Renseignez-le pour recevoir des offres et
          pouvoir le modifier ici.
        </p>
        {/* A plain anchor: the onboarding wizard lives outside the shell this
            section is mounted in, so there is no in-place navigation to keep. */}
        <a
          href="/candidat/onboarding"
          className="flex min-h-11 items-center rounded-xl bg-role-gradient px-5 text-sm font-semibold text-white focus-visible:ring-3 focus-visible:ring-role/40 focus-visible:outline-none"
        >
          Compléter mon profil
        </a>
      </section>
    );
  }

  const { form } = state;

  return (
    <section aria-labelledby={headingId} className="mt-8 flex flex-col gap-6">
      <h2 id={headingId} className="font-heading text-lg font-semibold text-ink">
        Mon profil
      </h2>

      <div className="flex flex-col gap-5 rounded-2xl border border-line bg-card p-5">
        <FileField
          label={PICTURE_LABEL}
          constraint={FILE_CONSTRAINTS.picture}
          previewUrl={fileUrl(state.picture)}
          emptyLabel="Aucune photo enregistrée"
          presentLabel="Photo enregistrée"
          busy={busy.picture}
          busyLabel="Envoi de la photo…"
          onSelect={(file) =>
            void writeFile(
              'picture',
              () => candidateProfileControllerReplacePicture({ file }),
              FILE_REPLACE_SUCCESS,
              fileReplaceBusiness,
            )
          }
          onRemove={() =>
            void writeFile(
              'picture',
              candidateProfileControllerRemovePicture,
              FILE_REMOVE_SUCCESS,
              fileRemoveBusiness,
            )
          }
        />

        {/* No preview and no read link: `/api/files` refuses the `cv` kind, and
            the only route that serves one cannot be consumed through the
            generated client, which reads every response as text. */}
        <FileField
          label={CV_LABEL}
          constraint={FILE_CONSTRAINTS.cv}
          previewUrl={null}
          hasFile={state.cvUrl !== null}
          presentLabel="CV enregistré"
          emptyLabel="Aucun CV enregistré"
          busy={busy.cv}
          busyLabel="Envoi du CV…"
          onSelect={(file) =>
            void writeFile(
              'cv',
              () => candidateProfileControllerReplaceCv({ file }),
              FILE_REPLACE_SUCCESS,
              fileReplaceBusiness,
            )
          }
          onRemove={() =>
            void writeFile(
              'cv',
              candidateProfileControllerRemoveCv,
              FILE_REMOVE_SUCCESS,
              fileRemoveBusiness,
            )
          }
        />
      </div>

      <form onSubmit={(event) => void save(event)} className="flex flex-col gap-5">
        <TextField
          label="Prénom"
          aria-required
          aria-invalid={invalid?.field === 'firstName'}
          aria-describedby={invalid?.field === 'firstName' ? errorId : undefined}
          autoComplete="given-name"
          maxLength={100}
          value={form.firstName}
          onChange={(event) => change({ firstName: event.target.value })}
        />

        <TextField
          label="Nom"
          aria-required
          aria-invalid={invalid?.field === 'lastName'}
          aria-describedby={invalid?.field === 'lastName' ? errorId : undefined}
          autoComplete="family-name"
          maxLength={100}
          value={form.lastName}
          onChange={(event) => change({ lastName: event.target.value })}
        />

        <CityField
          label="Ville"
          selected={
            form.city && form.postalCode ? { name: form.city, postalCode: form.postalCode } : null
          }
          onSelect={(city) => change({ city: city.name, postalCode: city.postalCode })}
          onClear={() => change({ city: '', postalCode: '' })}
        />

        <TextField
          label="Poste recherché"
          maxLength={255}
          value={form.desiredJobTitle}
          onChange={(event) => change({ desiredJobTitle: event.target.value })}
          placeholder="Développeuse Front React"
        />

        <OptionChips
          legend="Type(s) de contrat"
          name="account-contract-types"
          options={CONTRACT_TYPE_OPTIONS}
          values={form.contractTypes}
          onChange={(contractTypes) => change({ contractTypes })}
        />

        <OptionCards
          legend="Niveau d’expérience"
          name="account-experience-level"
          options={EXPERIENCE_LEVEL_OPTIONS}
          value={form.experienceLevel}
          onChange={(experienceLevel) => change({ experienceLevel })}
        />

        <OptionCards
          legend="Disponibilité"
          name="account-availability"
          options={AVAILABILITY_OPTIONS}
          value={form.availability}
          onChange={(availability) => change({ availability })}
        />

        {form.availability === 'WITHIN_DELAY' && (
          <TextField
            label="Disponible dans (mois)"
            inputMode="numeric"
            maxLength={2}
            value={form.availabilityDelayMonths}
            onChange={(event) =>
              change({ availabilityDelayMonths: digitsOnly(event.target.value) })
            }
            placeholder="3"
          />
        )}

        {form.availability === 'SPECIFIC_DATE' && (
          <TextField
            label="Date de disponibilité"
            type="date"
            value={form.availabilityDate}
            onChange={(event) => change({ availabilityDate: event.target.value })}
          />
        )}

        <OptionCards
          legend="Télétravail"
          name="account-remote-policy"
          options={REMOTE_POLICY_OPTIONS}
          value={form.remotePolicy}
          onChange={(remotePolicy) => change({ remotePolicy })}
        />

        <OptionCards
          legend="Mobilité"
          name="account-mobility-scope"
          options={MOBILITY_SCOPE_OPTIONS}
          value={form.mobilityScope}
          onChange={(mobilityScope) => change({ mobilityScope })}
          columns={2}
        />

        {form.mobilityScope === 'RADIUS' && (
          <TextField
            label="Rayon de mobilité (km)"
            inputMode="numeric"
            maxLength={4}
            value={form.mobilityRadiusKm}
            onChange={(event) => change({ mobilityRadiusKm: digitsOnly(event.target.value) })}
            placeholder="30"
          />
        )}

        <SalaryRange
          min={form.salaryMin}
          max={form.salaryMax}
          onMinChange={(salaryMin) => change({ salaryMin })}
          onMaxChange={(salaryMax) => change({ salaryMax })}
        />

        <TagInput
          label="Compétences"
          placeholder="React, TypeScript, Figma…"
          values={form.skills}
          onChange={(skills) => change({ skills })}
        />

        <TagInput
          label="Langues"
          placeholder="Anglais, Espagnol…"
          values={form.languages}
          onChange={(languages) => change({ languages })}
        />

        <RichTextField
          label="À propos de moi"
          maxLength={MAX_FREE_TEXT_LENGTH}
          value={form.bio}
          onChange={(bio) => change({ bio })}
          placeholder="Votre parcours, ce que vous cherchez, ce qui vous motive…"
        />

        <TextField
          label="Profil LinkedIn"
          type="url"
          autoComplete="url"
          maxLength={255}
          value={form.linkedinUrl}
          onChange={(event) => change({ linkedinUrl: event.target.value })}
          placeholder="https://linkedin.com/in/camille-martin"
        />

        {invalid && (
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
    </section>
  );
}
