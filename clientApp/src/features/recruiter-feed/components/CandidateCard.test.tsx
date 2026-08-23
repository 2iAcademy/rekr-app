import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFeedCandidates } from '../mocks';
import type { FeedCandidate } from '../types';
import { CandidateCard } from './CandidateCard';

const PANEL_ID = 'recruiter-feed-profile-panel';

const candidate = (overrides: Partial<FeedCandidate> = {}): FeedCandidate => ({
  ...mockFeedCandidates[0],
  ...overrides,
});

interface RenderOptions {
  isProfileOpen?: boolean;
  onToggleProfile?: () => void;
}

const renderCard = (overrides: Partial<FeedCandidate> = {}, options: RenderOptions = {}) => {
  const onToggleProfile = options.onToggleProfile ?? vi.fn();

  render(
    <CandidateCard
      candidate={candidate(overrides)}
      isProfileOpen={options.isProfileOpen ?? false}
      onToggleProfile={onToggleProfile}
      profilePanelId={PANEL_ID}
    />,
  );

  return { onToggleProfile };
};

const revealButton = () => screen.getByRole('button', { name: 'Voir le profil' });

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

  it('décrit le bouton de révélation comme replié et laisse le détail hors du DOM', () => {
    renderCard({ contractTypes: ['CDI'] }, { isProfileOpen: false });

    expect(revealButton()).toHaveAttribute('aria-expanded', 'false');
    expect(revealButton()).toHaveAttribute('aria-controls', PANEL_ID);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.queryByText('Contrats recherchés')).not.toBeInTheDocument();
  });

  it('garde le même nom accessible sur le bouton quand le détail est déplié', () => {
    renderCard({}, { isProfileOpen: true });

    expect(revealButton()).toHaveAttribute('aria-expanded', 'true');
  });

  it('prévient le parent au clic sur « Voir le profil » sans décider de l’état', async () => {
    const user = userEvent.setup();
    const onToggleProfile = vi.fn();
    renderCard({}, { onToggleProfile });

    await user.click(revealButton());

    expect(onToggleProfile).toHaveBeenCalledTimes(1);
    expect(revealButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('détaille contrats, télétravail et langues dans le panneau déplié', () => {
    renderCard(
      {
        firstName: 'Camille',
        lastName: 'Moreau',
        contractTypes: ['CDI', 'ALTERNANCE'],
        remotePolicy: 'HYBRID',
        languages: ['Français', 'Anglais'],
      },
      { isProfileOpen: true },
    );

    const panel = screen.getByRole('group', { name: 'Profil de Camille Moreau' });

    expect(panel).toHaveAttribute('id', PANEL_ID);
    expect(within(panel).getByText('Contrats recherchés')).toBeVisible();
    expect(itemsOf(within(panel).getByRole('list', { name: 'Contrats recherchés' }))).toEqual([
      'CDI',
      'Alternance',
    ]);
    expect(within(panel).getByText('Hybride')).toBeVisible();
    expect(within(panel).getByText('Langues')).toBeVisible();
    expect(itemsOf(within(panel).getByRole('list', { name: 'Langues' }))).toEqual([
      'Français',
      'Anglais',
    ]);
  });

  it('renvoie vers le profil LinkedIn dans un nouvel onglet, sans fuite d’origine', () => {
    renderCard(
      {
        firstName: 'Camille',
        lastName: 'Moreau',
        linkedinUrl: 'https://www.linkedin.com/in/camille-moreau',
      },
      { isProfileOpen: true },
    );

    const link = screen.getByRole('link', { name: 'Profil LinkedIn de Camille Moreau' });

    expect(link).toHaveAttribute('href', 'https://www.linkedin.com/in/camille-moreau');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('n’affiche aucun lien LinkedIn quand le candidat n’en a pas', () => {
    renderCard({ linkedinUrl: null }, { isProfileOpen: true });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('CandidateCard — profils incomplets', () => {
  it('n’affiche pas de rubrique au-dessus d’une liste vide', () => {
    renderCard({ skills: [], contractTypes: [], languages: [] }, { isProfileOpen: true });

    expect(screen.queryByRole('list', { name: 'Compétences' })).not.toBeInTheDocument();
    expect(screen.queryByText('Contrats recherchés')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Contrats recherchés' })).not.toBeInTheDocument();
    expect(screen.queryByText('Langues')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Langues' })).not.toBeInTheDocument();
  });

  it('tient un prénom ou un poste manquant sans laisser d’espace orpheline', () => {
    renderCard({ firstName: '', desiredJobTitle: '', bio: '' });

    expect(screen.getByRole('heading', { level: 2, name: 'Moreau · 29 ans' })).toBeVisible();
  });

  it('traite une URL vide comme une absence d’URL', () => {
    renderCard({ avatarUrl: '', linkedinUrl: '' }, { isProfileOpen: true });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('C')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('supporte une compétence déclarée deux fois', () => {
    renderCard({ skills: ['React', 'React'] });

    expect(itemsOf(screen.getByRole('list', { name: 'Compétences' }))).toEqual(['React', 'React']);
  });
});
