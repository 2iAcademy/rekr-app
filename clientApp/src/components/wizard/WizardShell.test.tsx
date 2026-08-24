import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WizardShell } from './WizardShell';

const renderShell = (props: Partial<Parameters<typeof WizardShell>[0]> = {}) =>
  render(
    <WizardShell
      role="recruiter"
      title="Ma société"
      current={2}
      total={5}
      submitLabel="Continuer"
      submittingLabel="Publication…"
      onBack={vi.fn()}
      onSubmit={vi.fn()}
      {...props}
    >
      <p>Contenu de l’étape</p>
    </WizardShell>,
  );

describe('WizardShell', () => {
  it('affiche le titre de l’étape, sa position et son contenu', () => {
    renderShell();

    expect(screen.getByRole('heading', { name: 'Ma société' })).toBeInTheDocument();
    expect(screen.getByText('Étape 2 sur 5')).toBeInTheDocument();
    expect(screen.getByText('Contenu de l’étape')).toBeInTheDocument();
  });

  // Anything outside `ROLE_THEMES` silently falls back to the candidate palette
  // (jsdom loads no CSS, so only `lib/roleTheme.test.ts` catches the drift).
  it('applique le thème du rôle demandé', () => {
    renderShell();
    expect(screen.getByRole('main')).toHaveAttribute('data-role', 'recruiter');

    renderShell({ role: 'candidate' });
    expect(screen.getAllByRole('main')[1]).toHaveAttribute('data-role', 'candidate');
  });

  // The mockups keep both a header chevron (mobile only) and an action-bar
  // button; they drive the same navigation.
  it('propose deux chemins de retour qui déclenchent la même action', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    renderShell({ onBack });

    const backButtons = screen.getAllByRole('button', { name: 'Retour' });
    expect(backButtons).toHaveLength(2);

    for (const button of backButtons) {
      await user.click(button);
    }

    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it('masque tout retour à la première étape', () => {
    renderShell({ current: 1 });

    expect(screen.queryByRole('button', { name: 'Retour' })).not.toBeInTheDocument();
  });

  it('soumet l’étape au clic sur l’action principale', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderShell({ onSubmit });

    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('affiche le libellé d’action fourni', () => {
    renderShell({ submitLabel: 'Publier mon offre' });

    expect(screen.getByRole('button', { name: 'Publier mon offre' })).toBeInTheDocument();
  });

  it('affiche l’erreur transmise en tant qu’alerte', () => {
    renderShell({ error: 'Renseignez votre prénom, votre nom et votre poste.' });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Renseignez votre prénom, votre nom et votre poste.',
    );
  });

  it('n’affiche pas d’alerte en l’absence d’erreur', () => {
    renderShell();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('désactive l’action principale pendant l’envoi et annonce le libellé fourni', () => {
    renderShell({
      submitting: true,
      submitLabel: 'Publier mon profil',
      submittingLabel: 'Enregistrement…',
    });

    expect(screen.getByRole('button', { name: 'Enregistrement…' })).toBeDisabled();
  });
});
