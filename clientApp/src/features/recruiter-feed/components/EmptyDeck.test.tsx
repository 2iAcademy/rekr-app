import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyDeck } from './EmptyDeck';

const RESET = 'Élargir la recherche';

describe('EmptyDeck', () => {
  it('impute le vide aux filtres quand ils écartent tout le reste', () => {
    render(<EmptyDeck reason="no-match" likedCount={2} onResetFilters={vi.fn()} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Aucun profil ne passe vos filtres' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/élargissez vos critères/i)).toBeInTheDocument();
  });

  it('propose de vider les filtres quand ils sont la cause', async () => {
    const user = userEvent.setup();
    const onResetFilters = vi.fn();
    render(<EmptyDeck reason="no-match" likedCount={0} onResetFilters={onResetFilters} />);

    await user.click(screen.getByRole('button', { name: RESET }));

    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });

  it('annonce la fin du deck quand tous les profils ont été traités', () => {
    render(<EmptyDeck reason="exhausted" likedCount={3} onResetFilters={vi.fn()} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Vous avez vu tous les profils' }),
    ).toBeInTheDocument();
    expect(screen.getByText('3 profils likés')).toBeInTheDocument();
  });

  // Offering a reset here would blame filters that are not the cause.
  it('n’offre pas de réinitialisation sur un deck épuisé', () => {
    render(<EmptyDeck reason="exhausted" likedCount={3} onResetFilters={vi.fn()} />);

    expect(screen.queryByRole('button', { name: RESET })).not.toBeInTheDocument();
  });

  // The maquette pairs the action with a "Plus tard" button; it has nowhere to
  // go until the app shell lands, and a button leading nowhere is worse than no
  // button, so the empty state exposes a single action.
  it('n’expose qu’une seule action, sans échappatoire sans destination', () => {
    render(<EmptyDeck reason="no-match" likedCount={0} onResetFilters={vi.fn()} />);

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: RESET })).toBeInTheDocument();
  });

  it('garde l’illustration décorative', () => {
    render(<EmptyDeck reason="exhausted" likedCount={0} onResetFilters={vi.fn()} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('accorde le récapitulatif au singulier', () => {
    render(<EmptyDeck reason="exhausted" likedCount={1} onResetFilters={vi.fn()} />);

    expect(screen.getByText('1 profil liké')).toBeInTheDocument();
  });

  it('récapitule une absence de like sans afficher un zéro', () => {
    render(<EmptyDeck reason="exhausted" likedCount={0} onResetFilters={vi.fn()} />);

    expect(screen.getByText('Aucun profil liké')).toBeInTheDocument();
    expect(screen.queryByText('0 profil liké')).not.toBeInTheDocument();
  });
});
