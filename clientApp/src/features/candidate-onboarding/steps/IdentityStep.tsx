import { CityField } from '@/components/form/CityField';
import { TextField } from '@/components/form/TextField';
import { markGroupIfInvalid, markIfInvalid } from '@/components/wizard/wizardError';
import type { StepProps } from './stepProps';

export function IdentityStep({ state, onChange, invalidField }: StepProps) {
  return (
    <>
      <p className="text-sm text-ink-muted">
        Votre nom n’apparaît aux recruteurs qu’après un match.
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

      <CityField
        label="Ville"
        selected={
          state.city && state.postalCode ? { name: state.city, postalCode: state.postalCode } : null
        }
        onSelect={(city) =>
          onChange({
            city: city.name,
            postalCode: city.postalCode,
          })
        }
        onClear={() => onChange({ city: '', postalCode: '' })}
        {...markGroupIfInvalid(invalidField, 'city')}
      />
    </>
  );
}
