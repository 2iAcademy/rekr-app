import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IdentityStep } from './IdentityStep';
import { WIZARD_ERROR_ID } from '@/components/wizard/wizardError';
import { emptyRecruiterOnboarding } from '../state';

const renderStep = (props: Partial<Parameters<typeof IdentityStep>[0]> = {}) =>
  render(<IdentityStep state={emptyRecruiterOnboarding} onChange={vi.fn()} {...props} />);

describe('IdentityStep', () => {
  it('rend les champs d’identité du recruteur', () => {
    renderStep();

    expect(screen.getByLabelText('Prénom')).toBeInTheDocument();
    expect(screen.getByLabelText('Nom')).toBeInTheDocument();
    expect(screen.getByLabelText('Poste / fonction')).toBeInTheDocument();
  });

  // `aria-required` rather than `required`: the native constraint would fire the
  // browser bubble before the per-step validation, hiding its business message.
  it('signale les champs obligatoires aux technologies d’assistance', () => {
    renderStep();

    for (const label of ['Prénom', 'Nom', 'Poste / fonction']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-required', 'true');
    }
    expect(screen.getByLabelText('Prénom')).not.toHaveAttribute('required');
  });

  it('marque le champ désigné comme fautif et le relie au message d’erreur', () => {
    renderStep({ invalidField: 'lastName' });

    const invalid = screen.getByLabelText('Nom');
    expect(invalid).toHaveAttribute('aria-invalid', 'true');
    expect(invalid).toHaveAttribute('aria-describedby', WIZARD_ERROR_ID);

    const untouched = screen.getByLabelText('Prénom');
    expect(untouched).toHaveAttribute('aria-invalid', 'false');
    expect(untouched).not.toHaveAttribute('aria-describedby');
  });

  it('affiche les valeurs déjà saisies', () => {
    renderStep({
      state: { ...emptyRecruiterOnboarding, firstName: 'Julien', jobTitle: 'Responsable RH' },
    });

    expect(screen.getByLabelText('Prénom')).toHaveValue('Julien');
    expect(screen.getByLabelText('Poste / fonction')).toHaveValue('Responsable RH');
  });

  it.each([
    ['Prénom', 'firstName'],
    ['Nom', 'lastName'],
    ['Poste / fonction', 'jobTitle'],
  ])('remonte la saisie du champ %s', async (label, field) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ onChange });

    await user.type(screen.getByLabelText(label), 'A');

    expect(onChange).toHaveBeenCalledWith({ [field]: 'A' });
  });
});
