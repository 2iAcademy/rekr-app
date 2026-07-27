import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignupPage } from './SignupPage';

describe('SignupPage', () => {
  it('soumet le rôle candidat par défaut avec email et mot de passe quand tout est valide', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SignupPage onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Email'), 'candidat@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      role: 'candidat',
      email: 'candidat@rekr.fr',
      password: 'motdepasse1',
    });
  });

  it('transmet le rôle recruteur quand il est sélectionné', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SignupPage onSubmit={onSubmit} />);

    await user.click(screen.getByRole('radio', { name: /recruteur/i }));
    await user.type(screen.getByLabelText('Email'), 'recruteur@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ role: 'recruteur' }));
  });

  it('bloque la soumission et affiche une erreur quand les mots de passe diffèrent', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SignupPage onSubmit={onSubmit} />);

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
    render(<SignupPage onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Email'), 'candidat@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Tu dois accepter les CGU pour continuer.');

    const confirm = screen.getByLabelText('Confirmer le mot de passe');
    expect(confirm).toHaveAttribute('aria-invalid', 'false');
    expect(confirm).not.toHaveAttribute('aria-describedby');
  });

  it('priorise le message de mot de passe quand mots de passe ET CGU sont invalides', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SignupPage onSubmit={onSubmit} />);

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
    render(<SignupPage onSubmit={onSubmit} />);

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
      role: 'candidat',
      email: 'candidat@rekr.fr',
      password: 'motdepasse1',
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it("efface le message d'erreur dès que l'utilisateur modifie le mot de passe", async () => {
    const user = userEvent.setup();
    render(<SignupPage onSubmit={vi.fn()} />);

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
    render(<SignupPage onBack={onBack} />);

    await user.click(screen.getByRole('button', { name: 'Retour' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('déclenche onSignIn au clic sur le lien Connexion', async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn();
    render(<SignupPage onSignIn={onSignIn} />);

    await user.click(screen.getByRole('button', { name: 'Connexion' }));

    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});
