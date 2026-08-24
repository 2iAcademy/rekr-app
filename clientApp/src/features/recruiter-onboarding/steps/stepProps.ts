import type { RecruiterOnboardingState } from '../state';
import type { RecruiterField } from '../wizard';

/**
 * Every step is presentational: it renders a slice of the wizard state and
 * reports edits as a patch. Persistence and navigation stay in the page.
 */
export interface StepProps {
  state: RecruiterOnboardingState;
  onChange: (patch: Partial<RecruiterOnboardingState>) => void;
  invalidField?: RecruiterField | null;
}
