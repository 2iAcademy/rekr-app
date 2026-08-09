import { OptionCards } from '@/components/form/OptionCards';
import { SalaryRange } from '../components/SalaryRange';
import { CONTRACT_TYPE_OPTIONS, EXPERIENCE_LEVEL_OPTIONS, REMOTE_POLICY_OPTIONS } from '../options';
import { WIZARD_ERROR_ID, type StepProps } from './stepProps';
import type { RecruiterField } from '../wizard';

export function MatchingStep({ state, onChange, invalidField }: StepProps) {
  const markGroup = (field: RecruiterField) => ({
    invalid: invalidField === field,
    describedBy: invalidField === field ? WIZARD_ERROR_ID : undefined,
  });

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
