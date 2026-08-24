import { COMPANY_SIZES, CONTRACT_TYPES, EXPERIENCE_LEVELS, REMOTE_POLICIES } from '@/domain/enums';
import { createDraftStorage } from '@/lib/draftStorage';
import { emptyRecruiterOnboarding, type RecruiterOnboardingState } from './state';

const storage = createDraftStorage<RecruiterOnboardingState>(
  'recruiter',
  4,
  emptyRecruiterOnboarding,
  {
    size: COMPANY_SIZES,
    contractType: CONTRACT_TYPES,
    minExperienceLevel: EXPERIENCE_LEVELS,
    remotePolicy: REMOTE_POLICIES,
  },
);

export const {
  key: draftStorageKey,
  load: loadDraft,
  save: saveDraft,
  clear: clearDraft,
} = storage;
