import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFeedCandidates } from '../mocks';
import type { FeedCandidate } from '../types';
import { CandidateCard } from './CandidateCard';

const candidate = (overrides: Partial<FeedCandidate> = {}): FeedCandidate => ({
  ...mockFeedCandidates[0],
  ...overrides,
});

const renderCard = (overrides: Partial<FeedCandidate> = {}, onViewProfile = vi.fn()) => {
  render(<CandidateCard candidate={candidate(overrides)} onViewProfile={onViewProfile} />);

  return { onViewProfile };
};

const profileButton = () => screen.getByRole('button', { name: /^Voir le profil/ });

const itemsOf = (list: HTMLElement): (string | null)[] =>
  within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent);

describe('CandidateCard', () => {
  it('annonce le nom et l’âge du candidat comme titre de la carte', () => {
    renderCard({ firstName: 'Camille', lastName: 'Moreau', age: 29 });

    expect(
      screen.getByRole('heading', { level: 2, name: 'Camille Moreau · 29 ans' }),
    ).toBeVisible();
  });

  it('annonce le nom seul quand l’âge est inconnu', () => {
    renderCard({ firstName: 'Thomas', lastName: 'Leroy', age: null });

    expect(screen.getByRole('heading', { level: 2, name: 'Thomas Leroy' })).toBeVisible();
  });

  it('affiche le poste recherché et la bio', () => {
    renderCard({ desiredJobTitle: 'Développeuse back-end', bio: 'Sept ans sur des API.' });

    expect(screen.getByText('Développeuse back-end')).toBeVisible();
    expect(screen.getByText('Sept ans sur des API.')).toBeVisible();
  });

  it('compose la ligne méta avec le lieu, l’expérience et la disponibilité', () => {
    renderCard({
      city: 'Lyon',
      experienceLevel: 'CONFIRME',
      availability: 'IMMEDIATE',
      availabilityDelayMonths: null,
      availabilityDate: null,
    });

    expect(screen.getByText('Lyon · Confirmé · Dispo immédiate')).toBeVisible();
  });

  it('ne laisse pas de séparateur orphelin dans la ligne méta quand la ville est inconnue', () => {
    renderCard({
      city: null,
      experienceLevel: 'SENIOR',
      availability: 'WITHIN_DELAY',
      availabilityDelayMonths: 3,
      availabilityDate: null,
    });

    expect(screen.getByText('Senior · Dispo sous 3 mois')).toBeVisible();
  });

  it('affiche la photo du candidat avec son nom complet en texte alternatif', () => {
    renderCard({
      firstName: 'Camille',
      lastName: 'Moreau',
      avatarUrl: 'https://cdn.rekr.test/camille.jpg',
    });

    expect(screen.getByRole('img', { name: 'Camille Moreau' })).toHaveAttribute(
      'src',
      'https://cdn.rekr.test/camille.jpg',
    );
  });

  it('affiche l’initiale du prénom en décor, faute de photo, plutôt qu’une fausse image', () => {
    renderCard({ firstName: 'Camille', lastName: 'Moreau', avatarUrl: null });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('C')).toHaveAttribute('aria-hidden', 'true');
  });

  it('liste les compétences dans une vraie liste', () => {
    renderCard({ skills: ['Symfony', 'PostgreSQL', 'Docker'] });

    expect(itemsOf(screen.getByRole('list', { name: 'Compétences' }))).toEqual([
      'Symfony',
      'PostgreSQL',
      'Docker',
    ]);
  });

  it('nomme la liste des compétences sans rubrique visible, comme la maquette', () => {
    renderCard({ skills: ['Symfony'] });

    expect(screen.getByRole('list', { name: 'Compétences' })).toBeVisible();
    expect(screen.queryByText('Compétences')).not.toBeInTheDocument();
  });

  it('énonce la prétention en une phrase, sans rubrique visible', () => {
    renderCard({ salaryMin: 42000, salaryMax: 48000 });

    expect(screen.getByText('Souhaite 42 - 48 k€')).toBeVisible();
    expect(screen.queryByText('Prétention salariale')).not.toBeInTheDocument();
  });

  it('assume une prétention non communiquée', () => {
    renderCard({ salaryMin: null, salaryMax: null });

    expect(screen.getByText('Prétention non communiquée')).toBeVisible();
  });
});

describe('CandidateCard — accès au détail', () => {
  it('ouvre l’écran de détail au clic, sans se comporter en panneau dépliable', async () => {
    const user = userEvent.setup();
    const onViewProfile = vi.fn();
    renderCard({}, onViewProfile);

    expect(profileButton()).not.toHaveAttribute('aria-expanded');
    expect(profileButton()).not.toHaveAttribute('aria-controls');

    await user.click(profileButton());

    expect(onViewProfile).toHaveBeenCalledTimes(1);
  });

  it('nomme le bouton avec le candidat, le libellé seul étant ambigu entre deux cartes', () => {
    renderCard({ firstName: 'Camille', lastName: 'Moreau' });

    expect(screen.getByRole('button', { name: 'Voir le profil de Camille Moreau' })).toBeVisible();
  });

  it('garde la bio tronquée sur la carte, la version complète revenant à l’écran de détail', () => {
    // The clamp has no observable effect in jsdom, which does no layout: the
    // class is the only witness. Asserted anyway because the truncation is the
    // decision here — it used to be lifted when the in-card panel unfolded, and
    // that panel is gone.
    renderCard({ bio: 'Sept ans sur des API.' });

    expect(screen.getByText('Sept ans sur des API.')).toHaveClass('line-clamp-3');
  });
});

describe('CandidateCard — profils incomplets', () => {
  it('n’affiche pas de rubrique au-dessus d’une liste vide', () => {
    renderCard({ skills: [] });

    expect(screen.queryByRole('list', { name: 'Compétences' })).not.toBeInTheDocument();
    expect(screen.queryByText('Compétences')).not.toBeInTheDocument();
  });

  it('tient un prénom ou un poste manquant sans laisser d’espace orpheline', () => {
    renderCard({ firstName: '', desiredJobTitle: '', bio: '' });

    expect(screen.getByRole('heading', { level: 2, name: 'Moreau · 29 ans' })).toBeVisible();
  });

  it('traite une photo vide comme une absence de photo', () => {
    renderCard({ avatarUrl: '' });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('C')).toHaveAttribute('aria-hidden', 'true');
  });

  it('supporte une compétence déclarée deux fois', () => {
    renderCard({ skills: ['React', 'React'] });

    expect(itemsOf(screen.getByRole('list', { name: 'Compétences' }))).toEqual(['React', 'React']);
  });
});
