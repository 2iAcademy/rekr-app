import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { anOffer } from '../fixtures';
import { OfferCard } from './OfferCard';

describe('OfferCard', () => {
  it('rend le titre, la ligne de contexte et le salaire de l’offre', () => {
    render(<OfferCard offer={anOffer} onViewOffer={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Développeur Frontend React' })).toBeInTheDocument();
    expect(screen.getByText('Studio Lumen · CDI · Hybride · Lyon')).toBeInTheDocument();
    expect(screen.getByText('45 - 55 k€')).toBeInTheDocument();
  });

  /**
   * Une offre qui n'a rien renseigné entre dans le deck de tout le monde : le
   * filtrage par profil la laisse passer plutôt que de la traiter comme un
   * refus. Le taire reviendrait à faire lire un accord là où il n'y a qu'un
   * silence — un candidat qui a demandé du télétravail complet croirait que
   * l'offre le propose.
   */
  it('dit explicitement ce que l’offre n’a pas renseigné', () => {
    render(
      <OfferCard
        offer={{ ...anOffer, contractType: null, remotePolicy: null }}
        onViewOffer={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Studio Lumen · Contrat non précisé · Télétravail non précisé · Lyon'),
    ).toBeInTheDocument();
  });

  it('écarte de la ligne de contexte la ville absente, qui n’engage rien', () => {
    render(<OfferCard offer={{ ...anOffer, city: null }} onViewOffer={vi.fn()} />);

    expect(screen.getByText('Studio Lumen · CDI · Hybride')).toBeInTheDocument();
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
