import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearAllDrafts } from '@/lib/draftStorage';
import { clearDraft, draftStorageKey, loadDraft, saveDraft } from './draftStorage';
import { emptyRecruiterOnboarding } from './state';

const filled = { ...emptyRecruiterOnboarding, firstName: 'Julien', skills: ['React'] };

describe('draftStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('relit ce qui a été sauvegardé', () => {
    saveDraft(1, filled);

    expect(loadDraft(1)).toEqual(filled);
  });

  it('rend null quand aucun brouillon n’existe', () => {
    expect(loadDraft(1)).toBeNull();
  });

  it('efface le brouillon', () => {
    saveDraft(1, filled);
    clearDraft(1);

    expect(loadDraft(1)).toBeNull();
  });

  // Two recruiters can share a tab: a session that expires and another login.
  // Neither may inherit the other's half-written identity.
  it('ne restaure pas le brouillon d’un autre utilisateur', () => {
    saveDraft(1, filled);

    expect(loadDraft(2)).toBeNull();
  });

  it('efface les brouillons de tous les utilisateurs', () => {
    saveDraft(1, filled);
    saveDraft(2, filled);

    clearAllDrafts();

    expect(loadDraft(1)).toBeNull();
    expect(loadDraft(2)).toBeNull();
  });

  // A half-written or hand-edited entry must not crash the wizard on mount.
  it('ignore un contenu illisible', () => {
    sessionStorage.setItem(draftStorageKey(1), '{ ceci n’est pas du JSON');

    expect(loadDraft(1)).toBeNull();
  });

  it('ignore un contenu qui n’a pas la forme attendue', () => {
    sessionStorage.setItem(draftStorageKey(1), JSON.stringify({ firstName: 42 }));

    expect(loadDraft(1)).toBeNull();
  });

  it('rejette un brouillon incomplet', () => {
    sessionStorage.setItem(draftStorageKey(1), JSON.stringify({ firstName: 'Julien' }));

    expect(loadDraft(1)).toBeNull();
  });

  // A draft written before an enum was narrowed would otherwise be restored,
  // show no selected card, pass validation, and 400 at the final step.
  it.each(['size', 'contractType', 'minExperienceLevel', 'remotePolicy'])(
    'rejette un brouillon dont %s est hors du domaine',
    (field) => {
      sessionStorage.setItem(
        draftStorageKey(1),
        JSON.stringify({ ...emptyRecruiterOnboarding, [field]: 'OBSOLETE' }),
      );

      expect(loadDraft(1)).toBeNull();
    },
  );

  it('accepte un brouillon dont les choix ne sont pas encore faits', () => {
    saveDraft(1, emptyRecruiterOnboarding);

    expect(loadDraft(1)).toEqual(emptyRecruiterOnboarding);
  });

  it('rejette un brouillon dont une liste n’en est pas une', () => {
    sessionStorage.setItem(
      draftStorageKey(1),
      JSON.stringify({ ...emptyRecruiterOnboarding, benefits: 'Mutuelle' }),
    );

    expect(loadDraft(1)).toBeNull();
  });

  it('n’explose pas quand le stockage est indisponible', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => saveDraft(1, filled)).not.toThrow();
  });
});
