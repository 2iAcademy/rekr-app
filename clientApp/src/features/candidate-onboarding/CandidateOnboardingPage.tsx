import { useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '@/api/customFetch';
import {
  candidateProfileControllerCreate,
  candidateProfileControllerUpdate,
} from '@/api/generated';
import { WizardShell } from '@/components/wizard/WizardShell';
import { clearDraft, loadDraft, saveDraft } from './draftStorage';
import { buildCandidateProfilePayload } from './payload';
import { emptyCandidateOnboarding, type CandidateOnboardingState } from './state';
import { IdentityStep } from './steps/IdentityStep';
import { PreferencesStep } from './steps/PreferencesStep';
import { ProjectStep } from './steps/ProjectStep';
import { ShowcaseStep } from './steps/ShowcaseStep';
import type { StepProps } from './steps/stepProps';
import { CANDIDATE_STEPS, validateStep, type CandidateField, type CandidateStepId } from './wizard';

const STEP_COMPONENTS: Record<CandidateStepId, (props: StepProps) => ReactNode> = {
  identity: IdentityStep,
  project: ProjectStep,
  preferences: PreferencesStep,
  showcase: ShowcaseStep,
};

const LAST_STEP = CANDIDATE_STEPS.length - 1;

const PUBLISH_FAILURE = 'Impossible de publier votre profil. Réessayez dans un instant.';

const failureMessage = (caught: unknown): string => {
  if (!(caught instanceof ApiError)) {
    return PUBLISH_FAILURE;
  }

  if (caught.status === 401 || caught.status === 403) {
    return 'Votre session a expiré. Reconnectez-vous pour publier votre profil.';
  }

  if (caught.status === 400) {
    return 'Certaines informations ont été refusées. Vérifiez les champs saisis.';
  }

  return PUBLISH_FAILURE;
};

interface CandidateOnboardingPageProps {
  userId: number;
  onCompleted?: () => void;
}

export function CandidateOnboardingPage({ userId, onCompleted }: CandidateOnboardingPageProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<CandidateOnboardingState>(
    () => loadDraft(userId) ?? emptyCandidateOnboarding,
  );
  // A failed request has no offending field, hence the nullable `field`.
  const [error, setError] = useState<{ field: CandidateField | null; message: string } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    saveDraft(userId, state);
  }, [userId, state]);

  const handleChange = (patch: Partial<CandidateOnboardingState>): void => {
    setState((current) => ({ ...current, ...patch }));
    setError(null);
  };

  /**
   * The API answers 409 as soon as a profile exists — because an earlier attempt
   * failed after creating it, or because the candidate is going through the
   * wizard a second time. Treating that as a plain success would report the
   * journey finished while silently dropping everything typed in the four steps,
   * so the same payload is replayed as an update.
   */
  const publish = async (): Promise<void> => {
    setSubmitting(true);
    const payload = buildCandidateProfilePayload(state);

    try {
      try {
        await candidateProfileControllerCreate(payload);
      } catch (caught) {
        if (!(caught instanceof ApiError) || caught.status !== 409) {
          throw caught;
        }

        await candidateProfileControllerUpdate(payload);
      }

      clearDraft(userId);
      onCompleted?.();
    } catch (caught) {
      setError({ field: null, message: failureMessage(caught) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (): void => {
    const invalid = validateStep(stepIndex, state);
    if (invalid) {
      setError(invalid);
      return;
    }

    setError(null);

    if (stepIndex === LAST_STEP) {
      void publish();
      return;
    }

    setStepIndex(stepIndex + 1);
  };

  const handleBack = (): void => {
    setError(null);
    setStepIndex((current) => Math.max(current - 1, 0));
  };

  const Step = STEP_COMPONENTS[CANDIDATE_STEPS[stepIndex].id];

  return (
    <WizardShell
      role="candidate"
      title={CANDIDATE_STEPS[stepIndex].title}
      current={stepIndex + 1}
      total={CANDIDATE_STEPS.length}
      submitLabel={stepIndex === LAST_STEP ? 'Publier mon profil' : 'Continuer'}
      submittingLabel="Publication…"
      error={error?.message ?? null}
      submitting={submitting}
      onBack={handleBack}
      onSubmit={handleSubmit}
    >
      <Step state={state} onChange={handleChange} invalidField={error?.field ?? null} />
    </WizardShell>
  );
}
