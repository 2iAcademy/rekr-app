import { OptionCards } from '@/components/form/OptionCards';
import { OptionChips } from '@/components/form/OptionChips';
import { TextField } from '@/components/form/TextField';
import { markGroupIfInvalid, markIfInvalid } from '@/components/wizard/wizardError';
import {
  AVAILABILITY_OPTIONS,
  CONTRACT_TYPE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
} from '@/domain/options';
import { digitsOnly } from '@/lib/numbers';
import type { StepProps } from './stepProps';

export function ProjectStep({ state, onChange, invalidField }: StepProps) {
  return (
    <>
      <TextField
        label="Poste recherché"
        aria-required
        {...markIfInvalid(invalidField, 'desiredJobTitle')}
        maxLength={255}
        value={state.desiredJobTitle}
        onChange={(event) => onChange({ desiredJobTitle: event.target.value })}
        placeholder="Développeuse Front React"
      />

      <OptionChips
        legend="Type(s) de contrat"
        name="candidate-contract-types"
        options={CONTRACT_TYPE_OPTIONS}
        values={state.contractTypes}
        onChange={(contractTypes) => onChange({ contractTypes })}
        {...markGroupIfInvalid(invalidField, 'contractTypes')}
      />

      <OptionCards
        legend="Niveau d’expérience"
        name="candidate-experience-level"
        options={EXPERIENCE_LEVEL_OPTIONS}
        value={state.experienceLevel}
        onChange={(experienceLevel) => onChange({ experienceLevel })}
        {...markGroupIfInvalid(invalidField, 'experienceLevel')}
      />

      <OptionCards
        legend="Disponibilité"
        name="candidate-availability"
        options={AVAILABILITY_OPTIONS}
        value={state.availability}
        onChange={(availability) => onChange({ availability })}
        {...markGroupIfInvalid(invalidField, 'availability')}
      />

      {state.availability === 'WITHIN_DELAY' && (
        <TextField
          label="Disponible dans (mois)"
          aria-required
          {...markIfInvalid(invalidField, 'availabilityDelayMonths')}
          inputMode="numeric"
          maxLength={2}
          value={state.availabilityDelayMonths}
          onChange={(event) =>
            onChange({ availabilityDelayMonths: digitsOnly(event.target.value) })
          }
          placeholder="3"
        />
      )}

      {state.availability === 'SPECIFIC_DATE' && (
        <TextField
          label="Date de disponibilité"
          type="date"
          aria-required
          {...markIfInvalid(invalidField, 'availabilityDate')}
          value={state.availabilityDate}
          onChange={(event) => onChange({ availabilityDate: event.target.value })}
        />
      )}
    </>
  );
}
