import { TextField } from '@/components/form/TextField';
import { markIfInvalid } from '@/components/wizard/wizardError';
import type { StepProps } from './stepProps';

export function IdentityStep({ state, onChange, invalidField }: StepProps) {
  return (
    <>
      <p className="text-sm text-ink-muted">
        Ces informations n’apparaissent aux candidats qu’après un match.
      </p>

      <TextField
        label="Prénom"
        aria-required
        {...markIfInvalid(invalidField, 'firstName')}
        autoComplete="given-name"
        maxLength={100}
        value={state.firstName}
        onChange={(event) => onChange({ firstName: event.target.value })}
        placeholder="Camille"
      />

      <TextField
        label="Nom"
        aria-required
        {...markIfInvalid(invalidField, 'lastName')}
        autoComplete="family-name"
        maxLength={100}
        value={state.lastName}
        onChange={(event) => onChange({ lastName: event.target.value })}
        placeholder="Martin"
      />

      <TextField
        label="Poste / fonction"
        aria-required
        {...markIfInvalid(invalidField, 'jobTitle')}
        autoComplete="organization-title"
        maxLength={150}
        value={state.jobTitle}
        onChange={(event) => onChange({ jobTitle: event.target.value })}
        placeholder="Responsable RH"
      />
    </>
  );
}
