import type { FormEvent } from 'react';
import { CityField } from '@/components/form/CityField';
import { OptionCards } from '@/components/form/OptionCards';
import { RichTextField } from '@/components/form/RichTextField';
import { TagInput } from '@/components/form/TagInput';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import { SalaryRange } from '@/components/form/SalaryRange';
import {
  markGroupIfInvalid,
  markIfInvalid,
  WIZARD_ERROR_ID,
} from '@/components/wizard/wizardError';
import {
  CONTRACT_TYPE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  REMOTE_POLICY_OPTIONS,
} from '@/domain/options';
import { OFFER_STATUS_OPTIONS } from '@/domain/offerStatus';
import type { OfferFormValue } from '@/features/recruiter-offers/offerPayload';
import type { OfferFormError } from '@/features/recruiter-offers/offerValidation';
import { MAX_FREE_TEXT_LENGTH } from '@/lib/bounds';

interface OfferFormProps {
  value: OfferFormValue;
  onChange: (fields: Partial<OfferFormValue>) => void;
  onSubmit: () => void;
  submitting: boolean;
  /** Wording of the action — « Créer l’offre » or « Enregistrer ». */
  submitLabel: string;
  error: OfferFormError | null;
}

/**
 * The offer form, shared by creation and edition: the two differ only by what
 * fills it and where the answer goes, so the fields themselves are written once.
 *
 * Presentational on purpose — it holds no state, runs no validation and calls no
 * endpoint. The page owns the value, decides when it is valid, and hands back the
 * failing field.
 */
export function OfferForm({
  value,
  onChange,
  onSubmit,
  submitting,
  submitLabel,
  error,
}: OfferFormProps) {
  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8 desktop:gap-10">
      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-base font-semibold text-ink">L’offre</h2>

        <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:items-start md:gap-5">
          <TextField
            label="Titre du poste"
            aria-required
            {...markIfInvalid(error?.field, 'title')}
            maxLength={255}
            placeholder="Développeur Front"
            value={value.title}
            onChange={(event) => onChange({ title: event.target.value })}
          />

          <CityField
            label="Ville du poste"
            selected={
              value.city && value.postalCode
                ? { name: value.city, postalCode: value.postalCode }
                : null
            }
            onSelect={(city) => onChange({ city: city.name, postalCode: city.postalCode })}
            onClear={() => onChange({ city: '', postalCode: '' })}
            {...markGroupIfInvalid(error?.field, 'city')}
          />
        </div>

        <RichTextField
          label="Missions"
          aria-required
          {...markIfInvalid(error?.field, 'description')}
          maxLength={MAX_FREE_TEXT_LENGTH}
          placeholder="Ce que la personne fera au quotidien, l’équipe, les outils…"
          value={value.description}
          onChange={(description) => onChange({ description })}
        />

        <TagInput
          label="Compétences recherchées"
          placeholder="React, TypeScript, Figma…"
          values={value.skills}
          onChange={(skills) => onChange({ skills })}
          {...markGroupIfInvalid(error?.field, 'skills')}
        />
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="font-heading text-base font-semibold text-ink">Le poste</h2>

        <OptionCards
          legend="Type de contrat"
          name="offer-contract-type"
          options={CONTRACT_TYPE_OPTIONS}
          value={value.contractType}
          onChange={(contractType) => onChange({ contractType })}
          {...markGroupIfInvalid(error?.field, 'contractType')}
        />

        <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start md:gap-x-8">
          <OptionCards
            legend="Expérience requise"
            name="offer-experience-level"
            options={EXPERIENCE_LEVEL_OPTIONS}
            value={value.minExperienceLevel}
            onChange={(minExperienceLevel) => onChange({ minExperienceLevel })}
            columns={2}
            {...markGroupIfInvalid(error?.field, 'minExperienceLevel')}
          />

          <OptionCards
            legend="Télétravail"
            name="offer-remote-policy"
            options={REMOTE_POLICY_OPTIONS}
            value={value.remotePolicy}
            onChange={(remotePolicy) => onChange({ remotePolicy })}
            {...markGroupIfInvalid(error?.field, 'remotePolicy')}
          />
        </div>

        <SalaryRange
          min={value.salaryMin}
          max={value.salaryMax}
          onMinChange={(salaryMin) => onChange({ salaryMin })}
          onMaxChange={(salaryMax) => onChange({ salaryMax })}
          describedBy={markIfInvalid(error?.field, 'salaryMax')['aria-describedby']}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-base font-semibold text-ink">Publication</h2>
        <p className="text-sm text-ink-muted">
          Seule une offre publiée est visible des candidats. Vous pouvez la remettre en brouillon ou
          la fermer à tout moment.
        </p>

        <OptionCards
          legend="Statut de l’offre"
          name="offer-status"
          options={OFFER_STATUS_OPTIONS}
          value={value.status}
          onChange={(status) => onChange({ status })}
        />
      </section>

      {error !== null && (
        // The id is the one every field above points at through `markIfInvalid`;
        // it comes from the shared helper so the two cannot drift apart.
        <p id={WIZARD_ERROR_ID} role="alert" className="text-xs text-destructive">
          {error.message}
        </p>
      )}

      <div className="flex justify-start">
        <Button type="submit" variant="role" size="xl" disabled={submitting}>
          {submitting ? 'Enregistrement…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
