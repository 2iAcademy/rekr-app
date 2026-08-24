import { OptionCards } from '@/components/form/OptionCards';
import { SalaryRange } from '@/components/form/SalaryRange';
import {
  CONTRACT_TYPE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  REMOTE_POLICY_OPTIONS,
} from '@/domain/options';
import { markGroupIfInvalid, WIZARD_ERROR_ID } from '@/components/wizard/wizardError';
import type { StepProps } from './stepProps';
import type { RecruiterField } from '../wizard';

export function MatchingStep({ state, onChange, invalidField }: StepProps) {
  const markGroup = (field: RecruiterField) => markGroupIfInvalid(invalidField, field);

  return (
    <>
      <p className="text-sm text-ink-muted">
        Ces critères déterminent à qui votre offre est proposée.
      </p>

      <OptionCards
        legend="Type de contrat"
        name="offer-contract-type"
        options={CONTRACT_TYPE_OPTIONS}
        value={state.contractType}
        onChange={(contractType) => onChange({ contractType })}
        {...markGroup('contractType')}
      />

      <OptionCards
        legend="Expérience requise"
        name="offer-experience-level"
        options={EXPERIENCE_LEVEL_OPTIONS}
        value={state.minExperienceLevel}
        onChange={(minExperienceLevel) => onChange({ minExperienceLevel })}
        {...markGroup('minExperienceLevel')}
      />

      <OptionCards
        legend="Télétravail"
        name="offer-remote-policy"
        options={REMOTE_POLICY_OPTIONS}
        value={state.remotePolicy}
        onChange={(remotePolicy) => onChange({ remotePolicy })}
        {...markGroup('remotePolicy')}
      />

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
