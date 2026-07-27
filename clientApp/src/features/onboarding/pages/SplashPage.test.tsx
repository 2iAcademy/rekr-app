import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SplashPage } from './SplashPage';

describe('SplashPage', () => {
  it("n'affiche pas le compteur de matches quand weeklyMatches vaut 0 (défaut)", () => {
    render(<SplashPage />);

    expect(screen.queryByText(/cette semaine/i)).not.toBeInTheDocument();
  });

  it('affiche « match » au singulier pour 1 match', () => {
    render(<SplashPage weeklyMatches={1} />);

    expect(screen.getByText('Déjà 1 match cette semaine')).toBeInTheDocument();
  });

  it('affiche « matchs » au pluriel au-delà de 1', () => {
    render(<SplashPage weeklyMatches={3} />);

    expect(screen.getByText('Déjà 3 matchs cette semaine')).toBeInTheDocument();
  });

  it('déclenche onCreateAccount et onSignIn au clic sur les boutons', async () => {
    const user = userEvent.setup();
    const onCreateAccount = vi.fn();
    const onSignIn = vi.fn();
    render(<SplashPage onCreateAccount={onCreateAccount} onSignIn={onSignIn} />);

    await user.click(screen.getByRole('button', { name: 'Créer un compte' }));
    await user.click(screen.getByRole('button', { name: "J'ai déjà un compte" }));

    expect(onCreateAccount).toHaveBeenCalledTimes(1);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});
