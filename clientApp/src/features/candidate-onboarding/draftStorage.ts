import { AVAILABILITIES, EXPERIENCE_LEVELS, REMOTE_POLICIES } from '@/domain/enums';
import { createDraftStorage } from '@/lib/draftStorage';
import { emptyCandidateOnboarding, MOBILITY_SCOPES, type CandidateOnboardingState } from './state';

const storage = createDraftStorage<CandidateOnboardingState>(
  'candidate',
  2,
  emptyCandidateOnboarding,
  {
    experienceLevel: EXPERIENCE_LEVELS,
    availability: AVAILABILITIES,
    remotePolicy: REMOTE_POLICIES,
    mobilityScope: MOBILITY_SCOPES,
  },
);

export const {
  key: draftStorageKey,
  load: loadDraft,
  save: saveDraft,
  clear: clearDraft,
} = storage;
