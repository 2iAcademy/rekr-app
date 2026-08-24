import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from './PasswordInput';

const renderPassword = (props: Partial<Parameters<typeof PasswordInput>[0]> = {}) =>
  render(
    <>
      <label htmlFor="pwd">Mot de passe</label>
      <PasswordInput id="pwd" {...props} />
    </>,
  );

describe('PasswordInput', () => {
  it('masque la valeur par défaut', () => {
    renderPassword();

    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Afficher le mot de passe' })).toBeInTheDocument();
  });

  it('révèle la valeur au clic sur la bascule, puis la masque de nouveau', async () => {
    const user = userEvent.setup();
    renderPassword();

    await user.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }));

    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Masquer le mot de passe' }));

    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'password');
  });

  it('ne soumet pas le formulaire qui la contient', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <label htmlFor="pwd">Mot de passe</label>
        <PasswordInput id="pwd" />
      </form>,
    );

    await user.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('nomme la bascule d’après le champ qu’elle dévoile', async () => {
    const user = userEvent.setup();
    renderPassword({ subject: 'la confirmation du mot de passe' });

    await user.click(
      screen.getByRole('button', { name: 'Afficher la confirmation du mot de passe' }),
    );

    expect(
      screen.getByRole('button', { name: 'Masquer la confirmation du mot de passe' }),
    ).toBeInTheDocument();
  });

  it("transmet les attributs d'accessibilité et de saisie à l'input", () => {
    renderPassword({
      required: true,
      minLength: 8,
      autoComplete: 'new-password',
      'aria-invalid': true,
      'aria-describedby': 'signup-error',
    });

    const input = screen.getByLabelText('Mot de passe');

    expect(input).toBeRequired();
    expect(input).toHaveAttribute('minlength', '8');
    expect(input).toHaveAttribute('autocomplete', 'new-password');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'signup-error');
  });
});
