import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authControllerForgotPassword } from '@/api/generated';
import { ApiError } from '@/api/customFetch';
import { Toaster } from '@/components/ui/sonner';
import { ForgotPasswordPage } from './ForgotPasswordPage';

vi.mock('@/api/generated', () => ({
  authControllerForgotPassword: vi.fn(),
}));

const forgotRequest = vi.mocked(authControllerForgotPassword);

const apiError = (status: number, data: unknown) =>
  new ApiError({ status, statusText: '', url: '/api/auth/password/forgot', data });

const noContent = {
  data: undefined,
  status: 204,
  headers: new Headers(),
} as unknown as Awaited<ReturnType<typeof authControllerForgotPassword>>;

const renderForgot = (props: Parameters<typeof ForgotPasswordPage>[0] = {}) =>
  render(
    <>
      <ForgotPasswordPage {...props} />
      <Toaster />
    </>,
  );

const submitEmail = async (user: ReturnType<typeof userEvent.setup>, value: string) => {
  await user.type(screen.getByLabelText('Email'), value);
  await user.click(screen.getByRole('button', { name: 'Envoyer le lien' }));
};

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    forgotRequest.mockResolvedValue(noContent);
  });

  it("soumet l'email et affiche la confirmation d'envoi", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderForgot({ onSubmit });

    await submitEmail(user, 'user@rekr.fr');

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ email: 'user@rekr.fr' });

    const confirmation = screen.getByRole('status');
    expect(confirmation).toHaveTextContent('Email envoyé.');
    expect(confirmation).toHaveTextContent('user@rekr.fr');
    expect(screen.getByRole('heading', { name: 'Email envoyé.' })).toHaveFocus();
  });

  it("transmet l'email tel qu'il a été saisi et le réaffiche à l'identique", async () => {
    const user = userEvent.setup();
    renderForgot();

    await submitEmail(user, 'User@Rekr.FR');

    expect(forgotRequest).toHaveBeenCalledTimes(1);
    expect(forgotRequest).toHaveBeenCalledWith({ email: 'User@Rekr.FR' });
    expect(screen.getByRole('status')).toHaveTextContent('User@Rekr.FR');
  });

  /*
   * The screen is the other half of the anti-enumeration guarantee: the server
   * answers 204 for an unknown address, but a front-end that worded a refusal
   * differently would hand the distinction straight back.
   */
  it("affiche exactement le même écran de confirmation lorsque le serveur refuse l'adresse", async () => {
    const user = userEvent.setup();
    renderForgot();

    await submitEmail(user, 'connu@rekr.fr');
    const accepted = screen.getByRole('status').innerHTML;

    forgotRequest.mockRejectedValue(apiError(404, { statusCode: 404, message: 'Not Found' }));
    await user.click(screen.getByRole('button', { name: "Modifier l'email" }));
    await user.clear(screen.getByLabelText('Email'));
    await submitEmail(user, 'connu@rekr.fr');

    expect(screen.getByRole('status').innerHTML).toBe(accepted);
    expect(document.querySelector('[data-sonner-toast]')).toBeNull();
  });

  it('signale une panne serveur sans confirmer un envoi', async () => {
    const user = userEvent.setup();
    forgotRequest.mockRejectedValue(apiError(500, { statusCode: 500 }));
    renderForgot();

    await submitEmail(user, 'user@rekr.fr');

    const message = await screen.findByText('Une erreur est survenue. Réessayez dans un instant.');
    expect(message.closest('[data-sonner-toast]')).toHaveAttribute('data-type', 'error');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Envoyer le lien' })).toBeInTheDocument();
  });

  /*
   * Native email validation accepts a domain without a dot, so `jean@gmail`
   * reaches the server and comes back a 400: nothing was sent, and the screen
   * must not pretend otherwise.
   */
  it("signale une adresse refusée par le serveur sans confirmer d'envoi", async () => {
    const user = userEvent.setup();
    forgotRequest.mockRejectedValue(
      apiError(400, { statusCode: 400, message: ['email must be an email'] }),
    );
    renderForgot();

    await submitEmail(user, 'jean@gmail');

    await screen.findByText("Cette adresse email n'est pas valide. Vérifiez votre saisie.");
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Envoyer le lien' })).toBeInTheDocument();
  });

  it('invite à patienter quand les demandes sont trop nombreuses', async () => {
    const user = userEvent.setup();
    forgotRequest.mockRejectedValue(apiError(429, { statusCode: 429 }));
    renderForgot();

    await submitEmail(user, 'user@rekr.fr');

    await screen.findByText('Trop de demandes. Patientez une minute avant de réessayer.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it("permet de revenir au formulaire pour corriger l'email", async () => {
    const user = userEvent.setup();
    renderForgot();

    await submitEmail(user, 'user@rekr.fr');
    await user.click(screen.getByRole('button', { name: "Modifier l'email" }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('user@rekr.fr');
  });

  it('déclenche onBack et onSignIn sur les liens de navigation', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onSignIn = vi.fn();
    renderForgot({ onBack, onSignIn });

    await user.click(screen.getByRole('button', { name: 'Retour' }));
    await user.click(screen.getByRole('button', { name: 'Connexion' }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});
