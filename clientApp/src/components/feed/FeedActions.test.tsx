import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedActions } from './FeedActions';

const renderActions = (props: Partial<{ onPass: () => void; onLike: () => void }> = {}) =>
  render(<FeedActions onPass={vi.fn()} onLike={vi.fn()} {...props} />);

describe('FeedActions', () => {
  it('rend les deux décisions dans l’ordre passer / liker', () => {
    renderActions();

    const [pass, like] = screen.getAllByRole('button');

    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(pass).toHaveAccessibleName('Passer');
    expect(like).toHaveAccessibleName('Liker');
  });

  // The detail action lives on the card itself ("Voir le profil"): a third
  // circle here would be a second control for the same panel.
  it('ne propose pas de troisième action pour le détail', () => {
    renderActions();

    expect(screen.queryByRole('button', { name: 'Détail' })).not.toBeInTheDocument();
  });

  // The lowercase caption sits under the circle: readable for sighted users,
  // hidden from assistive tech so it does not double the button's own name.
  it('légende chaque cercle en minuscules sans doubler le nom accessible', () => {
    renderActions();

    for (const caption of ['passer', 'liker']) {
      expect(screen.getByText(caption)).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('remonte le rejet du profil courant', async () => {
    const user = userEvent.setup();
    const onPass = vi.fn();
    renderActions({ onPass });

    await user.click(screen.getByRole('button', { name: 'Passer' }));

    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it('remonte le like du profil courant', async () => {
    const user = userEvent.setup();
    const onLike = vi.fn();
    renderActions({ onLike });

    await user.click(screen.getByRole('button', { name: 'Liker' }));

    expect(onLike).toHaveBeenCalledTimes(1);
  });
});
