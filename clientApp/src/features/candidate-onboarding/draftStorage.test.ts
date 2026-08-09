import { describe, it, expect, beforeEach } from 'vitest';
import { draftStorageKey as recruiterDraftKey } from '@/features/recruiter-onboarding/draftStorage';
import { clearAllDrafts } from '@/lib/draftStorage';
import { clearDraft, draftStorageKey, loadDraft, saveDraft } from './draftStorage';
import { emptyCandidateOnboarding } from './state';

const filled = {
  ...emptyCandidateOnboarding,
  firstName: 'Ada',
  contractTypes: ['CDI' as const],
  skills: ['React'],
};

describe('draftStorage candidat', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('relit ce qui a été sauvegardé', () => {
    saveDraft(1, filled);

    expect(loadDraft(1)).toEqual(filled);
  });

  it('efface le brouillon', () => {
    saveDraft(1, filled);
    clearDraft(1);

    expect(loadDraft(1)).toBeNull();
  });

  // Both wizards can be reached by the same account id; sharing a key would let
  // one restore the other's shape and fail the type check for nothing.
  it('ne partage pas sa clé avec le brouillon recruteur', () => {
    expect(draftStorageKey(1)).not.toBe(recruiterDraftKey(1));
  });

  it('est effacé par la purge globale des brouillons', () => {
    saveDraft(1, filled);

    clearAllDrafts();

    expect(loadDraft(1)).toBeNull();
  });

  it('ignore un brouillon dont une valeur d’énumération n’existe plus', () => {
    sessionStorage.setItem(
      draftStorageKey(1),
      JSON.stringify({ ...filled, experienceLevel: 'STAGIAIRE' }),
    );

    expect(loadDraft(1)).toBeNull();
  });
});
