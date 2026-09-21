import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { anOffer } from '../fixtures';
import { OfferCard } from './OfferCard';

/** The value shown next to a fact's label in the card's list of facts. */
const fact = (label: string): string | null =>
  screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent ?? null;

describe('OfferCard', () => {
  it('rend le titre, l’entreprise et les faits qui décident de l’offre', () => {
    render(<OfferCard offer={anOffer} onViewOffer={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Développeur Frontend React' })).toBeInTheDocument();
    expect(screen.getByText('Studio Lumen')).toBeInTheDocument();
    expect(screen.getByText('Lyon')).toBeInTheDocument();
    expect(fact('Contrat')).toBe('CDI');
    expect(fact('Télétravail')).toBe('Hybride');
    expect(fact('Expérience')).toBe('Confirmé');
    expect(fact('Salaire')).toBe('45–55 k€');
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

    expect(fact('Contrat')).toBe('Non précisé');
    expect(fact('Télétravail')).toBe('Non précisé');
  });

  it('n’affiche pas de ville absente, qui n’engage rien', () => {
    render(<OfferCard offer={{ ...anOffer, city: null }} onViewOffer={vi.fn()} />);

    expect(screen.queryByText('Lyon')).not.toBeInTheDocument();
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
