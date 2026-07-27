import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authControllerLogin } from '@/api/generated';
import { SigninPage } from './SigninPage';

vi.mock('@/api/generated', () => ({
  authControllerLogin: vi.fn(),
}));

const loginRequest = vi.mocked(authControllerLogin);

describe('SigninPage', () => {
  beforeEach(() => {
    loginRequest.mockResolvedValue({ data: undefined, status: 200, headers: new Headers() });
  });

  it('soumet email et mot de passe', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SigninPage onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Email'), 'user@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'secret42');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(loginRequest).toHaveBeenCalledWith({ email: 'user@rekr.fr', password: 'secret42' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ email: 'user@rekr.fr', password: 'secret42' });
  });

  it("ne notifie pas le parent quand l'API rejette la connexion", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    loginRequest.mockRejectedValue(new Error('Unauthorized'));
    render(<SigninPage onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Email'), 'user@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'secret42');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('déclenche onBack et onSignUp sur les liens de navigation', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onSignUp = vi.fn();
    render(<SigninPage onBack={onBack} onSignUp={onSignUp} />);

    await user.click(screen.getByRole('button', { name: 'Retour' }));
    await user.click(screen.getByRole('button', { name: 'Inscription' }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSignUp).toHaveBeenCalledTimes(1);
  });
});
