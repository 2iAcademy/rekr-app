import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyDeck } from './EmptyDeck';

const RESET = 'Élargir la recherche';
const likedLabel = (count: number): string =>
  count === 0 ? 'Aucun profil liké' : count === 1 ? '1 profil liké' : `${count} profils likés`;

const renderEmptyDeck = (props: Partial<React.ComponentProps<typeof EmptyDeck>> = {}) =>
  render(
    <EmptyDeck
      reason="no-match"
      title="Aucun profil ne passe vos filtres"
      itemPlural="candidats"
      likedCount={0}
      likedLabel={likedLabel}
      onResetFilters={vi.fn()}
      {...props}
    />,
  );

describe('EmptyDeck', () => {
  it('impute le vide aux filtres quand ils écartent tout le reste', () => {
    renderEmptyDeck({ likedCount: 2 });

    expect(
      screen.getByRole('heading', { level: 2, name: 'Aucun profil ne passe vos filtres' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/élargissez vos critères/i)).toBeInTheDocument();
  });

  it('propose de vider les filtres quand ils sont la cause', async () => {
    const user = userEvent.setup();
    const onResetFilters = vi.fn();
    renderEmptyDeck({ onResetFilters });

    await user.click(screen.getByRole('button', { name: RESET }));

    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });

  it('annonce la fin du deck quand tous les profils ont été traités', () => {
    renderEmptyDeck({ reason: 'exhausted', title: 'Vous avez vu tous les profils', likedCount: 3 });

    expect(
      screen.getByRole('heading', { level: 2, name: 'Vous avez vu tous les profils' }),
    ).toBeInTheDocument();
    expect(screen.getByText('3 profils likés')).toBeInTheDocument();
  });

  it('n’offre pas de réinitialisation sur un deck épuisé', () => {
    renderEmptyDeck({ reason: 'exhausted', title: 'Vous avez vu tous les profils', likedCount: 3 });

    expect(screen.queryByRole('button', { name: RESET })).not.toBeInTheDocument();
  });

  it('n’expose qu’une seule action, sans échappatoire sans destination', () => {
    renderEmptyDeck();

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: RESET })).toBeInTheDocument();
  });

  it('garde l’illustration décorative', () => {
    renderEmptyDeck({ reason: 'exhausted', title: 'Vous avez vu tous les profils' });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('accorde le récapitulatif au singulier', () => {
    renderEmptyDeck({ reason: 'exhausted', title: 'Vous avez vu tous les profils', likedCount: 1 });

    expect(screen.getByText('1 profil liké')).toBeInTheDocument();
  });

  it('récapitule une absence de like sans afficher un zéro', () => {
    renderEmptyDeck({ reason: 'exhausted', title: 'Vous avez vu tous les profils' });

    expect(screen.getByText('Aucun profil liké')).toBeInTheDocument();
    expect(screen.queryByText('0 profil liké')).not.toBeInTheDocument();
  });
});
