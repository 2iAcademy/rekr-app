import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { anOffer } from '../fixtures';
import { OfferCard } from './OfferCard';

describe('OfferCard', () => {
  it('rend le titre, la ligne de contexte et le salaire de l’offre', () => {
    render(<OfferCard offer={anOffer} onViewOffer={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Développeur Frontend React' })).toBeInTheDocument();
    expect(screen.getByText('Studio Lumen · CDI · Lyon')).toBeInTheDocument();
    expect(screen.getByText('45 - 55 k€')).toBeInTheDocument();
  });

  // Le type de contrat reste une information sur l'offre — ce n'est plus un
  // filtre, mais le candidat doit toujours pouvoir le lire sur la carte.
  it('écarte de la ligne de contexte ce que l’offre n’a pas renseigné', () => {
    render(
      <OfferCard offer={{ ...anOffer, contractType: null, city: null }} onViewOffer={vi.fn()} />,
    );

    expect(screen.getByText('Studio Lumen')).toBeInTheDocument();
  });

  it('délègue l’ouverture du détail', async () => {
    const user = userEvent.setup();
    const onViewOffer = vi.fn();
    render(<OfferCard offer={anOffer} onViewOffer={onViewOffer} />);

    await user.click(
      screen.getByRole('button', { name: "Voir l'offre Développeur Frontend React" }),
    );

    expect(onViewOffer).toHaveBeenCalledTimes(1);
  });
});
