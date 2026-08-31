import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { EmptyDeck } from './EmptyDeck';

const renderDeck = (overrides: Partial<Parameters<typeof EmptyDeck>[0]> = {}) =>
  render(
    <MemoryRouter>
      <EmptyDeck
        title="Tu as tout vu"
        itemPlural="offres"
        likedCount={0}
        likedLabel={(count) => `${count} likées`}
        {...overrides}
      />
    </MemoryRouter>,
  );

describe('EmptyDeck', () => {
  it('annonce la fin du paquet avec le titre reçu', () => {
    renderDeck();

    expect(screen.getByRole('heading', { name: 'Tu as tout vu' })).toBeInTheDocument();
  });

  it('emprunte le vocabulaire du feed pour le corps du message', () => {
    renderDeck({ itemPlural: 'profils' });

    expect(screen.getByText(/la liste des profils se met à jour/)).toBeInTheDocument();
  });

  /**
   * Le paquet est constitué côté serveur à partir du profil : il n'y a plus de
   * filtre d'écran à réinitialiser, donc la seule façon de l'élargir est
   * d'aller changer ses critères.
   */
  it('renvoie vers le profil pour élargir la recherche', () => {
    renderDeck();

    expect(screen.getByRole('link', { name: 'Ajuster mes critères' })).toHaveAttribute(
      'href',
      '/profil',
    );
  });

  it('ne propose plus de réinitialiser des filtres', () => {
    renderDeck();

    expect(screen.queryByRole('button', { name: 'Élargir la recherche' })).not.toBeInTheDocument();
  });

  it('rappelle le nombre d’éléments likés', () => {
    renderDeck({ likedCount: 3 });

    expect(screen.getByText('3 likées')).toBeInTheDocument();
  });
});
