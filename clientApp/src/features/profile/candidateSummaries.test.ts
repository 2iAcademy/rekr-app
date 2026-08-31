import { describe, expect, it } from 'vitest';
import { emptyCandidateAccountForm, type CandidateAccountForm } from './candidateAccountForm';
import { candidateSummaries } from './candidateSummaries';

const form = (overrides: Partial<CandidateAccountForm> = {}): CandidateAccountForm => ({
  ...emptyCandidateAccountForm,
  ...overrides,
});

describe('candidateSummaries', () => {
  it('résume l’identité par le nom et la ville', () => {
    const summaries = candidateSummaries(
      form({ firstName: 'Camille', lastName: 'Moreau', city: 'Lyon' }),
    );

    expect(summaries.identity).toBe('Camille Moreau · Lyon');
  });

  it('résume le projet par le poste, les contrats et l’expérience', () => {
    const summaries = candidateSummaries(
      form({
        desiredJobTitle: 'Développeuse back-end',
        contractTypes: ['CDI', 'FREELANCE'],
        experienceLevel: 'CONFIRME',
      }),
    );

    expect(summaries.project).toBe('Développeuse back-end · CDI, Freelance · Confirmé');
  });

  // Le même vocabulaire que le reste du produit : « 42 - 48 k€ », pas les
  // chiffres bruts saisis dans le formulaire.
  it('exprime la prétention dans l’unité employée ailleurs', () => {
    const summaries = candidateSummaries(
      form({ remotePolicy: 'HYBRID', salaryMin: '42000', salaryMax: '48000' }),
    );

    expect(summaries.preferences).toBe('Hybride · 42 - 48 k€');
  });

  it('n’annonce pas de fourchette quand aucune borne n’est donnée', () => {
    const summaries = candidateSummaries(form({ remotePolicy: 'HYBRID' }));

    expect(summaries.preferences).toBe('Hybride');
  });

  it('accepte une seule borne de salaire', () => {
    const summaries = candidateSummaries(form({ salaryMin: '42000' }));

    expect(summaries.preferences).toBe('À partir de 42 k€');
  });

  it('compte les éléments de la vitrine, au singulier comme au pluriel', () => {
    expect(candidateSummaries(form({ skills: ['React'] })).showcase).toBe('1 compétence');
    expect(candidateSummaries(form({ skills: ['React', 'Vue'] })).showcase).toBe('2 compétences');
  });

  it('signale la présence d’une présentation sans la recopier', () => {
    const summaries = candidateSummaries(form({ bio: 'Sept ans sur des API de paiement.' }));

    expect(summaries.showcase).toBe('présentation');
  });

  /**
   * Une chaîne vide, pas un texte de remplacement : c'est l'en-tête de section
   * qui formule l'absence, et il est le seul à savoir comment le dire.
   */
  it('rend une chaîne vide pour une section jamais remplie', () => {
    const summaries = candidateSummaries(emptyCandidateAccountForm);

    expect(summaries).toEqual({
      identity: '',
      project: '',
      preferences: '',
      showcase: '',
    });
  });

  it('ignore les valeurs réduites à des espaces', () => {
    const summaries = candidateSummaries(form({ firstName: '   ', city: '  ' }));

    expect(summaries.identity).toBe('');
  });
});
