import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OfferApplicantDto } from '@/api/generated';
import { anApplicant } from '../fixtures';
import type { ApplicantDecision } from '../useApplicants';
import { CandidateDetailPage } from './CandidateDetailPage';

type Overrides = Partial<OfferApplicantDto> & {
  decision?: ApplicantDecision;
  pending?: boolean;
};

const renderPage = ({ decision = null, pending, ...overrides }: Overrides = {}) => {
  const onBack = vi.fn();
  const onLike = vi.fn();
  const onPass = vi.fn();

  render(
    <CandidateDetailPage
      candidate={{ ...anApplicant, ...overrides }}
      decision={decision}
      pending={pending}
      onBack={onBack}
      onLike={onLike}
      onPass={onPass}
    />,
  );

  return { onBack, onLike, onPass };
};

const factsOf = (): [string | null, string | null][] =>
  screen
    .getAllByRole('term')
    .map((term) => [term.textContent, term.nextElementSibling?.textContent ?? null]);

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

  it('situe le candidat sous son prénom', () => {
    renderPage();

    expect(screen.getByText('Lyon')).toBeInTheDocument();
  });

  it('présente expérience, disponibilité et télétravail en lignes libellé / valeur', () => {
    renderPage();

    expect(factsOf()).toEqual([
      ['Expérience', 'Confirmé'],
      ['Disponibilité', 'Immédiate'],
      ['Télétravail', 'Hybride'],
    ]);
  });

  it('écarte les informations non renseignées', () => {
    renderPage({ city: null, experienceLevel: null });

    expect(screen.queryByText('Lyon')).not.toBeInTheDocument();
    expect(factsOf()).toEqual([
      ['Disponibilité', 'Immédiate'],
      ['Télétravail', 'Hybride'],
    ]);
  });

  it('n’affiche aucune ligne de faits quand rien n’est renseigné', () => {
    renderPage({ experienceLevel: null, availability: null, remotePolicy: null });

    expect(screen.queryByRole('term')).not.toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: "Ça m'intéresse" }));

    expect(onLike).toHaveBeenCalledTimes(1);
  });

  it('remonte le passage', async () => {
    const user = userEvent.setup();
    const { onPass } = renderPage();

    await user.click(screen.getByRole('button', { name: 'Passer' }));

    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it('affiche la décision sauvegardée et désactive les deux actions', () => {
    renderPage({ decision: { kind: 'liked', at: '2026-09-16T09:30:00.000Z' } });

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Intérêt déjà enregistré');
    expect(status).toHaveAttribute('title', 'Décision enregistrée le 2026-09-16T09:30:00.000Z');
    expect(screen.getByRole('button', { name: "Ça m'intéresse" })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Passer' })).toBeDisabled();
  });

  it('affiche un passage sauvegardé et désactive les deux actions', () => {
    renderPage({ decision: { kind: 'passed', at: '2026-09-16T09:30:00.000Z' } });

    expect(screen.getByRole('status')).toHaveTextContent('Candidat déjà passé');
    expect(screen.getByRole('button', { name: "Ça m'intéresse" })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Passer' })).toBeDisabled();
  });

  it('désactive le like pendant l’envoi', () => {
    renderPage({ pending: true });

    expect(screen.getByRole('button', { name: "Ça m'intéresse" })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Passer' })).toBeDisabled();
  });

  // Ni CV, ni LinkedIn, ni prétention salariale : la projection vitrine ne les
  // porte pas, et l'écran ne doit pas donner l'impression qu'ils manquent.
  it('ne propose aucun lien vers des documents personnels', () => {
    renderPage();

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
