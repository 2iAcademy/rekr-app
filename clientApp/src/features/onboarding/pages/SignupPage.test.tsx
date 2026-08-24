import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authControllerSignup } from '@/api/generated';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { ApiError } from '@/api/customFetch';
import { Toaster } from '@/components/ui/sonner';
import { SignupPage } from './SignupPage';

vi.mock('@/api/generated', () => ({
  authControllerSignup: vi.fn(),
  authControllerLogin: vi.fn(),
  authControllerLogout: vi.fn(),
}));

const signupRequest = vi.mocked(authControllerSignup);

const authenticatedUser = {
  id: 1,
  email: 'candidat@rekr.fr',
  role: 'user',
  userType: 'candidate',
  isActive: true,
};

const apiError = (status: number, data: unknown) =>
  new ApiError({ status, statusText: '', url: '/api/auth/signup', data });

const renderSignup = (props: Parameters<typeof SignupPage>[0] = {}) =>
  render(
    <AuthProvider>
      <SignupPage {...props} />
      <Toaster />
    </AuthProvider>,
  );

describe('SignupPage', () => {
  beforeEach(() => {
    // The provider always fires a boot refresh on mount; without a token to
    // adopt here, it settles on anonymous and leaves these tests unaffected.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);
    signupRequest.mockResolvedValue({
      data: { accessToken: 'test-token', user: authenticatedUser },
      status: 201,
      headers: new Headers(),
    } as unknown as Awaited<ReturnType<typeof authControllerSignup>>);
  });

  it('soumet le rôle candidat par défaut avec email et mot de passe quand tout est valide', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderSignup({ onSubmit });

    await user.type(screen.getByLabelText('Email'), 'candidat@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(signupRequest).toHaveBeenCalledWith({
      email: 'candidat@rekr.fr',
      password: 'motdepasse1',
      userType: 'candidate',
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      role: 'candidate',
      email: 'candidat@rekr.fr',
      password: 'motdepasse1',
    });
  });

  it('transmet le rôle recruteur quand il est sélectionné', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderSignup({ onSubmit });

    await user.click(screen.getByRole('radio', { name: /recruteur/i }));
    await user.type(screen.getByLabelText('Email'), 'recruteur@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ role: 'recruiter' }));
  });

  it("expose le rôle sélectionné dans data-role pour l'accent de couleur", async () => {
    const user = userEvent.setup();
    renderSignup();

    expect(screen.getByRole('main')).toHaveAttribute('data-role', 'candidate');

    await user.click(screen.getByRole('radio', { name: /recruteur/i }));

    expect(screen.getByRole('main')).toHaveAttribute('data-role', 'recruiter');
  });

  it('affiche chaque mot de passe indépendamment de l’autre', async () => {
    const user = userEvent.setup();
    renderSignup();

    const password = screen.getByLabelText('Mot de passe');
    const confirm = screen.getByLabelText('Confirmer le mot de passe');

    await user.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }));

    expect(password).toHaveAttribute('type', 'text');
    expect(confirm).toHaveAttribute('type', 'password');

    await user.click(
      screen.getByRole('button', { name: 'Afficher la confirmation du mot de passe' }),
    );

    expect(password).toHaveAttribute('type', 'text');
    expect(confirm).toHaveAttribute('type', 'text');
  });

  it('bloque la soumission et affiche une erreur quand les mots de passe diffèrent', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderSignup({ onSubmit });

    await user.type(screen.getByLabelText('Email'), 'candidat@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse2');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Les mots de passe ne correspondent pas.');

    const confirm = screen.getByLabelText('Confirmer le mot de passe');
    expect(confirm).toHaveAttribute('aria-invalid', 'true');
    expect(confirm).toHaveAttribute('aria-describedby', 'signup-error');
  });

  it('bloque la soumission et affiche une erreur quand les CGU ne sont pas acceptées', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderSignup({ onSubmit });

    await user.type(screen.getByLabelText('Email'), 'candidat@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Vous devez accepter les CGU pour continuer.',
    );

    const confirm = screen.getByLabelText('Confirmer le mot de passe');
    expect(confirm).toHaveAttribute('aria-invalid', 'false');
    expect(confirm).not.toHaveAttribute('aria-describedby');
  });

  it('priorise le message de mot de passe quand mots de passe ET CGU sont invalides', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderSignup({ onSubmit });

    await user.type(screen.getByLabelText('Email'), 'candidat@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse2');
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Les mots de passe ne correspondent pas.');
  });

  it("permet une soumission réussie après correction de l'erreur", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderSignup({ onSubmit });

    const confirm = screen.getByLabelText('Confirmer le mot de passe');
    await user.type(screen.getByLabelText('Email'), 'candidat@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(confirm, 'motdepasse2');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.clear(confirm);
    await user.type(confirm, 'motdepasse1');
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      role: 'candidate',
      email: 'candidat@rekr.fr',
      password: 'motdepasse1',
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('confirme la création du compte par un toast de succès', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderSignup({ onSubmit });

    await user.type(screen.getByLabelText('Email'), 'candidat@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    const message = await screen.findByText('Compte créé. Bienvenue sur Rekr !');

    expect(message.closest('[data-sonner-toast]')).toHaveAttribute('data-type', 'success');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('reste génerique sur un 500 sans exposer le message technique', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    signupRequest.mockRejectedValue(
      apiError(500, { statusCode: 500, message: 'Internal server error' }),
    );
    renderSignup({ onSubmit });

    await user.type(screen.getByLabelText('Email'), 'candidat@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    const message = await screen.findByText('Une erreur est survenue. Réessayez dans un instant.');

    expect(message.closest('[data-sonner-toast]')).toHaveAttribute('data-type', 'error');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByText('Internal server error')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('annonce un email déjà utilisé sur un 409', async () => {
    const user = userEvent.setup();
    signupRequest.mockRejectedValue(
      apiError(409, { statusCode: 409, message: 'An account already exists for this email.' }),
    );
    renderSignup();

    await user.type(screen.getByLabelText('Email'), 'candidat@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(
      await screen.findByText(
        'Un compte existe déjà pour cet email. Connectez-vous ou utilisez une autre adresse.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('An account already exists for this email.')).not.toBeInTheDocument();
  });

  it('invite à patienter sur un 429', async () => {
    const user = userEvent.setup();
    signupRequest.mockRejectedValue(
      apiError(429, { statusCode: 429, message: 'ThrottlerException: Too Many Requests' }),
    );
    renderSignup();

    await user.type(screen.getByLabelText('Email'), 'candidat@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(
      await screen.findByText('Trop de tentatives. Patientez une minute avant de réessayer.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ThrottlerException/)).not.toBeInTheDocument();
  });

  it('signale un problème de connexion quand la requête n’aboutit pas', async () => {
    const user = userEvent.setup();
    signupRequest.mockRejectedValue(new TypeError('Failed to fetch'));
    renderSignup();

    await user.type(screen.getByLabelText('Email'), 'candidat@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(
      await screen.findByText(
        'Connexion au serveur impossible. Vérifiez votre connexion et réessayez.',
      ),
    ).toBeInTheDocument();
  });

  it('laisse la validation côté client en inline, sans aucun toast', async () => {
    const user = userEvent.setup();
    renderSignup({ onSubmit: vi.fn() });

    await user.type(screen.getByLabelText('Email'), 'candidat@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse2');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Les mots de passe ne correspondent pas.');
    expect(document.querySelector('[data-sonner-toast]')).toBeNull();
  });

  it("efface le message d'erreur dès que l'utilisateur modifie le mot de passe", async () => {
    const user = userEvent.setup();
    renderSignup({ onSubmit: vi.fn() });

    await user.type(screen.getByLabelText('Email'), 'candidat@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse2');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Mot de passe'), '2');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('déclenche onBack au clic sur le bouton retour', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    renderSignup({ onBack });

    await user.click(screen.getByRole('button', { name: 'Retour' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('déclenche onSignIn au clic sur le lien Connexion', async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn();
    renderSignup({ onSignIn });

    await user.click(screen.getByRole('button', { name: 'Connexion' }));

    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});
