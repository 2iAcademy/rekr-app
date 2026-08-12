import { OptionCards } from '@/components/form/OptionCards';
import { SalaryRange } from '@/components/form/SalaryRange';
import { TextField } from '@/components/form/TextField';
import {
  markGroupIfInvalid,
  markIfInvalid,
  WIZARD_ERROR_ID,
} from '@/components/wizard/wizardError';
import { REMOTE_POLICY_OPTIONS } from '@/domain/options';
import { digitsOnly } from '@/lib/numbers';
import { MOBILITY_SCOPE_OPTIONS } from '../options';
import type { StepProps } from './stepProps';

export function PreferencesStep({ state, onChange, invalidField }: StepProps) {
  return (
    <>
      <p className="text-sm text-ink-muted">
        Ces critères déterminent les offres qui vous sont proposées.
      </p>

      <OptionCards
        legend="Télétravail"
        name="candidate-remote-policy"
        options={REMOTE_POLICY_OPTIONS}
        value={state.remotePolicy}
        onChange={(remotePolicy) => onChange({ remotePolicy })}
        {...markGroupIfInvalid(invalidField, 'remotePolicy')}
      />

      <OptionCards
        legend="Mobilité"
        name="candidate-mobility-scope"
        options={MOBILITY_SCOPE_OPTIONS}
        value={state.mobilityScope}
        onChange={(mobilityScope) => onChange({ mobilityScope })}
        columns={2}
        {...markGroupIfInvalid(invalidField, 'mobilityScope')}
      />

      {state.mobilityScope === 'RADIUS' && (
        <TextField
          label="Rayon de mobilité (km)"
          aria-required
          {...markIfInvalid(invalidField, 'mobilityRadiusKm')}
          inputMode="numeric"
          maxLength={4}
          value={state.mobilityRadiusKm}
          onChange={(event) => onChange({ mobilityRadiusKm: digitsOnly(event.target.value) })}
          placeholder="30"
        />
      )}

      <SalaryRange
        min={state.salaryMin}
        max={state.salaryMax}
        onMinChange={(salaryMin) => onChange({ salaryMin })}
        onMaxChange={(salaryMax) => onChange({ salaryMax })}
        describedBy={invalidField === 'salaryMax' ? WIZARD_ERROR_ID : undefined}
      />
    </>
  );
}
