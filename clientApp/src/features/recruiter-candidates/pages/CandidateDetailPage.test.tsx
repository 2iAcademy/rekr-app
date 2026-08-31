import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OfferApplicantDto } from '@/api/generated';
import { anApplicant } from '../fixtures';
import { CandidateDetailPage } from './CandidateDetailPage';

type Overrides = Partial<OfferApplicantDto> & {
  liked?: boolean;
  pending?: boolean;
};

const renderPage = ({ liked, pending, ...overrides }: Overrides = {}) => {
  const onBack = vi.fn();
  const onLike = vi.fn();

  render(
    <CandidateDetailPage
      candidate={{ ...anApplicant, ...overrides }}
      liked={liked}
      pending={pending}
      onBack={onBack}
      onLike={onLike}
    />,
  );

  return { onBack, onLike };
};

const itemsOf = (list: HTMLElement): (string | null)[] =>
  within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent);

describe('CandidateDetailPage', () => {
  it('nomme la région par le prénom du candidat', () => {
    renderPage();

    expect(screen.getByRole('region', { name: 'Profil de Camille' })).toBeInTheDocument();
  });

  // Le prénom seul : la personne a manifesté son intérêt, elle n'a pas accepté
  // d'être identifiée. Le nom de famille attend la réciprocité.
  it('affiche le prénom en titre, jamais un nom complet', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Camille' })).toBeInTheDocument();
  });

  it('affiche le poste recherché', () => {
    renderPage();

    expect(screen.getByText('Développeuse back-end')).toBeInTheDocument();
  });

  it('assemble ville, expérience et disponibilité sur une seule ligne', () => {
    renderPage();

    expect(screen.getByText('Lyon · Confirmé · Immédiate')).toBeInTheDocument();
  });

  it('écarte de cette ligne les informations non renseignées', () => {
    renderPage({ city: null, experienceLevel: null });

    expect(screen.getByText('Immédiate')).toBeInTheDocument();
  });

  it('liste les compétences', () => {
    renderPage();

    expect(itemsOf(screen.getByRole('list', { name: 'Compétences' }))).toEqual([
      'Symfony',
      'PostgreSQL',
      'Docker',
    ]);
  });

  it('traduit les types de contrat recherchés', () => {
    renderPage({ contractTypes: ['CDI', 'ALTERNANCE'] });

    expect(itemsOf(screen.getByRole('list', { name: 'Contrats recherchés' }))).toEqual([
      'CDI',
      'Alternance',
    ]);
  });

  // Une rubrique au-dessus d'une liste vide annoncerait « Compétences, list, 0
  // items » : le bloc entier disparaît avec son contenu.
  it('masque une rubrique dont la liste est vide', () => {
    renderPage({ tags: [] });

    expect(screen.queryByRole('list', { name: 'Compétences' })).not.toBeInTheDocument();
  });

  it('affiche la politique de télétravail', () => {
    renderPage();

    expect(screen.getByText('Télétravail')).toBeInTheDocument();
    expect(screen.getByText('Hybride')).toBeInTheDocument();
  });

  it('masque le bloc télétravail quand il n’est pas renseigné', () => {
    renderPage({ remotePolicy: null });

    expect(screen.queryByText('Télétravail')).not.toBeInTheDocument();
  });

  it('affiche la présentation du candidat', () => {
    renderPage({ bio: 'Je cherche une équipe où la revue de code est un échange.' });

    expect(
      screen.getByText('Je cherche une équipe où la revue de code est un échange.'),
    ).toBeInTheDocument();
  });

  it('masque la présentation quand elle est vide', () => {
    renderPage({ bio: '   ' });

    expect(screen.queryByText('À propos')).not.toBeInTheDocument();
  });

  it('remonte la fermeture de l’écran', async () => {
    const user = userEvent.setup();
    const { onBack } = renderPage();

    await user.click(screen.getByRole('button', { name: 'Retour à la liste' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('remonte le like', async () => {
    const user = userEvent.setup();
    const { onLike } = renderPage();

    await user.click(screen.getByRole('button', { name: 'Liker' }));

    expect(onLike).toHaveBeenCalledTimes(1);
  });

  // Un intérêt déjà enregistré n'est pas à renvoyer : le bouton dit ce qui a
  // été fait plutôt que de réarmer une action sans effet.
  it('désactive le like une fois l’intérêt enregistré', () => {
    renderPage({ liked: true });

    expect(screen.getByRole('button', { name: 'Intérêt enregistré' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Liker' })).not.toBeInTheDocument();
  });

  it('désactive le like pendant l’envoi', () => {
    renderPage({ pending: true });

    expect(screen.getByRole('button', { name: 'Liker' })).toBeDisabled();
  });

  // Ni CV, ni LinkedIn, ni prétention salariale : la projection vitrine ne les
  // porte pas, et l'écran ne doit pas donner l'impression qu'ils manquent.
  it('ne propose aucun lien vers des documents personnels', () => {
    renderPage();

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
