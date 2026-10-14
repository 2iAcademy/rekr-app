import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { SplashPage } from './SplashPage';

describe('SplashPage', () => {
  it("n'affiche pas le compteur de matches quand weeklyMatches vaut 0 (défaut)", () => {
    render(
      <MemoryRouter>
        <SplashPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/cette semaine/i)).not.toBeInTheDocument();
  });

  it('affiche « match » au singulier pour 1 match', () => {
    render(
      <MemoryRouter>
        <SplashPage weeklyMatches={1} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Déjà 1 match cette semaine')).toBeInTheDocument();
  });

  it('affiche « matchs » au pluriel au-delà de 1', () => {
    render(
      <MemoryRouter>
        <SplashPage weeklyMatches={3} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Déjà 3 matchs cette semaine')).toBeInTheDocument();
  });

  it('déclenche onCreateAccount et onSignIn au clic sur les boutons', async () => {
    const user = userEvent.setup();
    const onCreateAccount = vi.fn();
    const onSignIn = vi.fn();
    render(
      <MemoryRouter>
        <SplashPage onCreateAccount={onCreateAccount} onSignIn={onSignIn} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Créer un compte' }));
    await user.click(screen.getByRole('button', { name: "J'ai déjà un compte" }));

    expect(onCreateAccount).toHaveBeenCalledTimes(1);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('relie les CGU et la politique de confidentialité citées sous les boutons', () => {
    render(
      <MemoryRouter>
        <SplashPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'CGU' })).toHaveAttribute('href', '/mentions-legales');
    expect(screen.getByRole('link', { name: 'politique de confidentialité' })).toHaveAttribute(
      'href',
      '/confidentialite',
    );
  });
});
