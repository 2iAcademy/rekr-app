import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { emptyOfferFeedFilters, type OfferFeedFilters } from '../types';
import { OfferFilterBar } from './OfferFilterBar';

const renderBar = (
  props: Partial<{
    filters: OfferFeedFilters;
    onChange: (filters: OfferFeedFilters) => void;
    resultCount: number;
  }> = {},
) =>
  render(
    <OfferFilterBar
      filters={emptyOfferFeedFilters}
      onChange={vi.fn()}
      resultCount={4}
      {...props}
    />,
  );

const toggle = () =>
  screen.getByRole('button', { name: /^(?:Plus de filtres|Masquer les filtres)/ });

const openPanel = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(toggle());
};

describe('OfferFilterBar', () => {
  it('affiche les filtres rapides dans l’ordre des offres', () => {
    renderBar();

    expect(
      screen
        .getAllByRole('button')
        .filter((button) => button.hasAttribute('aria-pressed'))
        .map((button) => button.textContent),
    ).toEqual([
      'CDI',
      'CDD',
      'Alternance',
      'Stage',
      'Freelance',
      'Intérim',
      'Sur site',
      'Hybride',
      'Full remote',
    ]);
  });

  it('déplie les groupes contrat et télétravail', async () => {
    const user = userEvent.setup();
    renderBar();

    await openPanel(user);

    expect(screen.getByRole('group', { name: 'Type de contrat' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Télétravail' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('4 offres correspondent');
  });

  it('ajoute un contrat sans modifier les filtres de télétravail', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBar({ filters: { contractTypes: [], remotePolicies: ['HYBRID'] }, onChange });

    await user.click(screen.getByRole('button', { name: 'Freelance' }));

    expect(onChange).toHaveBeenCalledWith({
      contractTypes: ['FREELANCE'],
      remotePolicies: ['HYBRID'],
    });
  });

  it('retire une politique de télétravail sélectionnée', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBar({
      filters: { contractTypes: ['CDD'], remotePolicies: ['ON_SITE', 'HYBRID'] },
      onChange,
    });

    await user.click(screen.getByRole('button', { name: 'Hybride' }));

    expect(onChange).toHaveBeenCalledWith({
      contractTypes: ['CDD'],
      remotePolicies: ['ON_SITE'],
    });
  });

  it('conserve l’ordre des options après une sélection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBar({ filters: { contractTypes: ['FREELANCE'], remotePolicies: [] }, onChange });

    await user.click(screen.getByRole('button', { name: 'CDD' }));

    expect(onChange).toHaveBeenCalledWith({
      contractTypes: ['CDD', 'FREELANCE'],
      remotePolicies: [],
    });
  });

  it('réinitialise les deux axes depuis le panneau déplié', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBar({ filters: { contractTypes: ['CDI'], remotePolicies: ['FULL_REMOTE'] }, onChange });

    await openPanel(user);
    await user.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));

    expect(onChange).toHaveBeenCalledWith(emptyOfferFeedFilters);
  });

  it('annonce correctement zéro et une offre', () => {
    const { rerender } = renderBar({ resultCount: 0 });

    expect(screen.getByRole('status')).toHaveTextContent('Aucune offre ne correspond');

    rerender(<OfferFilterBar filters={emptyOfferFeedFilters} onChange={vi.fn()} resultCount={1} />);

    expect(screen.getByRole('status')).toHaveTextContent('1 offre correspond');
  });
});
