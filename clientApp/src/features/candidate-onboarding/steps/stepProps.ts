import type { CandidateOnboardingState } from '../state';
import type { CandidateField } from '../wizard';

/**
 * Every step is presentational: it renders a slice of the wizard state and
 * reports edits as a patch. Persistence and navigation stay in the page.
 */
export interface StepProps {
  state: CandidateOnboardingState;
  onChange: (patch: Partial<CandidateOnboardingState>) => void;
  invalidField?: CandidateField | null;
}
