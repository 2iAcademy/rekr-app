import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ForgotPasswordPage } from './ForgotPasswordPage';

describe('ForgotPasswordPage', () => {
  it("soumet l'email et affiche la confirmation d'envoi", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ForgotPasswordPage onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Email'), 'user@rekr.fr');
    await user.click(screen.getByRole('button', { name: 'Envoyer le lien' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ email: 'user@rekr.fr' });

    const confirmation = screen.getByRole('status');
    expect(confirmation).toHaveTextContent('Email envoyé.');
    expect(confirmation).toHaveTextContent('user@rekr.fr');
    expect(screen.getByRole('heading', { name: 'Email envoyé.' })).toHaveFocus();
  });

  it("permet de revenir au formulaire pour corriger l'email", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Email'), 'user@rekr.fr');
    await user.click(screen.getByRole('button', { name: 'Envoyer le lien' }));
    await user.click(screen.getByRole('button', { name: "Modifier l'email" }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('user@rekr.fr');
  });

  it('déclenche onBack et onSignIn sur les liens de navigation', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onSignIn = vi.fn();
    render(<ForgotPasswordPage onBack={onBack} onSignIn={onSignIn} />);

    await user.click(screen.getByRole('button', { name: 'Retour' }));
    await user.click(screen.getByRole('button', { name: 'Connexion' }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});
