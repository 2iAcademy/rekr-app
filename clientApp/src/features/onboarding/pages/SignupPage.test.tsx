import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authControllerSignup } from '@/api/generated';
import { AuthProvider } from '@/features/auth/AuthProvider';
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

const renderSignup = (props: Parameters<typeof SignupPage>[0] = {}) =>
  render(
    <AuthProvider>
      <SignupPage {...props} />
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

  it("affiche une erreur et ne notifie pas le parent quand l'API refuse la création", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    signupRequest.mockRejectedValue(new Error('Bad Request'));
    renderSignup({ onSubmit });

    await user.type(screen.getByLabelText('Email'), 'candidat@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de créer le compte.');
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
