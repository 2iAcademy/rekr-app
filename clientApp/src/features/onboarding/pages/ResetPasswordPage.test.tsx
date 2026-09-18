import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authControllerResetPassword } from '@/api/generated';
import { ApiError } from '@/api/customFetch';
import { Toaster } from '@/components/ui/sonner';
import { ResetPasswordPage } from './ResetPasswordPage';

vi.mock('@/api/generated', () => ({
  authControllerResetPassword: vi.fn(),
}));

const resetRequest = vi.mocked(authControllerResetPassword);

const apiError = (status: number, data: unknown) =>
  new ApiError({ status, statusText: '', url: '/api/auth/password/reset', data });

const noContent = {
  data: undefined,
  status: 204,
  headers: new Headers(),
} as unknown as Awaited<ReturnType<typeof authControllerResetPassword>>;

const renderReset = (props: Parameters<typeof ResetPasswordPage>[0] = { token: 'jeton-valide' }) =>
  render(
    <>
      <ResetPasswordPage {...props} />
      <Toaster />
    </>,
  );

const fillPasswords = async (
  user: ReturnType<typeof userEvent.setup>,
  password: string,
  confirmation = password,
) => {
  await user.type(screen.getByLabelText('Nouveau mot de passe'), password);
  await user.type(screen.getByLabelText('Confirmer le mot de passe'), confirmation);
};

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRequest.mockResolvedValue(noContent);
  });

  it('envoie le jeton et le nouveau mot de passe, puis renvoie vers la connexion', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    renderReset({ token: 'jeton-valide', onSuccess });

    await fillPasswords(user, 'motdepasse1');
    await user.click(screen.getByRole('button', { name: 'Réinitialiser le mot de passe' }));

    expect(resetRequest).toHaveBeenCalledTimes(1);
    expect(resetRequest).toHaveBeenCalledWith({
      token: 'jeton-valide',
      password: 'motdepasse1',
    });

    const message = await screen.findByText(
      'Mot de passe réinitialisé. Connectez-vous avec votre nouveau mot de passe.',
    );
    expect(message.closest('[data-sonner-toast]')).toHaveAttribute('data-type', 'success');
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('annonce un lien invalide sans appeler le serveur quand le jeton est absent', async () => {
    renderReset({ token: null });

    expect(screen.getByRole('heading', { name: 'Lien invalide.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Demander un nouveau lien' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Réinitialiser le mot de passe' }),
    ).not.toBeInTheDocument();
    expect(resetRequest).not.toHaveBeenCalled();
  });

  it('propose de redemander un lien quand le serveur refuse le jeton', async () => {
    const user = userEvent.setup();
    const onRequestNewLink = vi.fn();
    resetRequest.mockRejectedValue(
      apiError(400, { statusCode: 400, message: "Ce lien de réinitialisation n'est plus valide." }),
    );
    renderReset({ token: 'jeton-perime', onRequestNewLink });

    await fillPasswords(user, 'motdepasse1');
    await user.click(screen.getByRole('button', { name: 'Réinitialiser le mot de passe' }));

    expect(
      await screen.findByRole('heading', { name: 'Ce lien n’est plus valide.' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Demander un nouveau lien' }));
    expect(onRequestNewLink).toHaveBeenCalledTimes(1);
  });

  it('refuse deux mots de passe différents sans appeler le serveur', async () => {
    const user = userEvent.setup();
    renderReset();

    await fillPasswords(user, 'motdepasse1', 'motdepasse2');
    await user.click(screen.getByRole('button', { name: 'Réinitialiser le mot de passe' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Les mots de passe ne correspondent pas.');
    expect(resetRequest).not.toHaveBeenCalled();
  });

  it('refuse un mot de passe de moins de 8 caractères sans appeler le serveur', async () => {
    const user = userEvent.setup();
    renderReset();

    await fillPasswords(user, 'court1');
    await user.click(screen.getByRole('button', { name: 'Réinitialiser le mot de passe' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Le mot de passe doit contenir au moins 8 caractères.',
    );
    expect(resetRequest).not.toHaveBeenCalled();
  });

  it('signale une panne serveur par un toast, en laissant le formulaire ressaisissable', async () => {
    const user = userEvent.setup();
    resetRequest.mockRejectedValue(apiError(500, { statusCode: 500 }));
    renderReset();

    await fillPasswords(user, 'motdepasse1');
    await user.click(screen.getByRole('button', { name: 'Réinitialiser le mot de passe' }));

    const message = await screen.findByText('Une erreur est survenue. Réessayez dans un instant.');
    expect(message.closest('[data-sonner-toast]')).toHaveAttribute('data-type', 'error');
    expect(
      screen.getByRole('button', { name: 'Réinitialiser le mot de passe' }),
    ).toBeInTheDocument();
  });
});
