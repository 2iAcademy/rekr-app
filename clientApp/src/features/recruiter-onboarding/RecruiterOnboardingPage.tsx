import { useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '@/api/customFetch';
import {
  companyControllerCreate,
  companyControllerUpdateMine,
  offerControllerCreate,
} from '@/api/generated';
import { WizardShell } from './components/WizardShell';
import { clearDraft, loadDraft, saveDraft } from './draftStorage';
import { buildCompanyPayload, buildOfferPayload } from './payload';
import { emptyRecruiterOnboarding, type RecruiterOnboardingState } from './state';
import { CompanyStep } from './steps/CompanyStep';
import { CultureStep } from './steps/CultureStep';
import { IdentityStep } from './steps/IdentityStep';
import { MatchingStep } from './steps/MatchingStep';
import { OfferStep } from './steps/OfferStep';
import type { StepProps } from './steps/stepProps';
import { RECRUITER_STEPS, validateStep, type RecruiterField, type RecruiterStepId } from './wizard';

const STEP_COMPONENTS: Record<RecruiterStepId, (props: StepProps) => ReactNode> = {
  identity: IdentityStep,
  company: CompanyStep,
  culture: CultureStep,
  offer: OfferStep,
  matching: MatchingStep,
};

const LAST_STEP = RECRUITER_STEPS.length - 1;

const PUBLISH_FAILURE = 'Impossible de publier votre profil. Réessayez dans un instant.';

const failureMessage = (caught: unknown): string => {
  if (!(caught instanceof ApiError)) {
    return PUBLISH_FAILURE;
  }

  if (caught.status === 401 || caught.status === 403) {
    return 'Votre session a expiré. Reconnectez-vous pour publier votre offre.';
  }

  if (caught.status === 400) {
    return 'Certaines informations ont été refusées. Vérifiez les champs saisis.';
  }

  return PUBLISH_FAILURE;
};

/**
 * The offer inherits the company location, but only while the recruiter has not
 * set one: re-copying on every visit would silently undo their edit.
 */
const inheritCompanyLocation = (state: RecruiterOnboardingState): RecruiterOnboardingState =>
  state.offerCity === '' && state.offerPostalCode === ''
    ? { ...state, offerCity: state.city, offerPostalCode: state.postalCode }
    : state;

interface RecruiterOnboardingPageProps {
  userId: number;
  onCompleted?: () => void;
}

export function RecruiterOnboardingPage({ userId, onCompleted }: RecruiterOnboardingPageProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<RecruiterOnboardingState>(
    () => loadDraft(userId) ?? emptyRecruiterOnboarding,
  );
  // A failed request has no offending field, hence the nullable `field`.
  const [error, setError] = useState<{ field: RecruiterField | null; message: string } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    saveDraft(userId, state);
  }, [userId, state]);

  const handleChange = (patch: Partial<RecruiterOnboardingState>): void => {
    setState((current) => ({ ...current, ...patch }));
    setError(null);
  };

  /**
   * `CompanyService.create` answers 409 as soon as the recruiter profile exists
   * — because an earlier attempt failed after creating it, or because the
   * recruiter is going through the wizard a second time. Treating that as a
   * plain success would publish the offer while silently dropping everything
   * typed in steps 1 to 3, so the same payload is replayed as an update.
   */
  const ensureCompany = async (): Promise<void> => {
    try {
      await companyControllerCreate(buildCompanyPayload(state));
    } catch (caught) {
      if (!(caught instanceof ApiError) || caught.status !== 409) {
        throw caught;
      }

      await companyControllerUpdateMine(buildCompanyPayload(state));
    }
  };

  const publish = async (): Promise<void> => {
    setSubmitting(true);

    try {
      await ensureCompany();
      await offerControllerCreate(buildOfferPayload(state));
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

    if (RECRUITER_STEPS[stepIndex].id === 'culture') {
      setState(inheritCompanyLocation);
    }

    setStepIndex(stepIndex + 1);
  };

  const handleBack = (): void => {
    setError(null);
    setStepIndex((current) => Math.max(current - 1, 0));
  };

  const Step = STEP_COMPONENTS[RECRUITER_STEPS[stepIndex].id];

  return (
    <WizardShell
      title={RECRUITER_STEPS[stepIndex].title}
      current={stepIndex + 1}
      total={RECRUITER_STEPS.length}
      submitLabel={stepIndex === LAST_STEP ? 'Publier mon offre' : 'Continuer'}
      error={error?.message ?? null}
      submitting={submitting}
      onBack={handleBack}
      onSubmit={handleSubmit}
    >
      <Step state={state} onChange={handleChange} invalidField={error?.field ?? null} />
    </WizardShell>
  );
}
