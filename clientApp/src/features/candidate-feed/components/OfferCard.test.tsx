import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFeedOffers } from '../mocks';
import { OfferCard } from './OfferCard';

describe('OfferCard', () => {
  it('affiche les informations nécessaires pour décider sur une offre', () => {
    render(<OfferCard offer={mockFeedOffers[0]} onViewOffer={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Développeur Frontend React' })).toBeVisible();
    expect(screen.getByText('Acme Studio · CDI · Lyon')).toBeVisible();
    expect(screen.getByText('42 - 50 k€')).toBeVisible();
    expect(screen.getByRole('list', { name: 'Stack technique' })).toBeVisible();
  });

  it('ouvre le détail depuis le lien Voir plus', async () => {
    const user = userEvent.setup();
    const onViewOffer = vi.fn();
    render(<OfferCard offer={mockFeedOffers[0]} onViewOffer={onViewOffer} />);

    await user.click(
      screen.getByRole('button', { name: "Voir l'offre Développeur Frontend React" }),
    );

    expect(onViewOffer).toHaveBeenCalledTimes(1);
  });
});
