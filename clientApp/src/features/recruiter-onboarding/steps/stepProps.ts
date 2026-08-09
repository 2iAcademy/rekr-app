import type { RecruiterOnboardingState } from '../state';
import type { RecruiterField } from '../wizard';

/**
 * Single wizard per screen, so a constant id is enough to point every field at
 * the one alert rendered by `WizardShell`.
 */
export const WIZARD_ERROR_ID = 'recruiter-wizard-error';

/**
 * Every step is presentational: it renders a slice of the wizard state and
 * reports edits as a patch. Persistence and navigation stay in the page.
 */
export interface StepProps {
  state: RecruiterOnboardingState;
  onChange: (patch: Partial<RecruiterOnboardingState>) => void;
  invalidField?: RecruiterField | null;
}

interface InvalidMarkers {
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
}

export const markIfInvalid = (
  invalidField: RecruiterField | null | undefined,
  field: RecruiterField,
): InvalidMarkers => {
  const invalid = invalidField === field;

  return {
    'aria-invalid': invalid,
    'aria-describedby': invalid ? WIZARD_ERROR_ID : undefined,
  };
};
