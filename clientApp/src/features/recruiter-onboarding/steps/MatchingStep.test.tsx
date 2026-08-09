import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatchingStep } from './MatchingStep';
import { emptyRecruiterOnboarding } from '../state';

const renderStep = (props: Partial<Parameters<typeof MatchingStep>[0]> = {}) =>
  render(<MatchingStep state={emptyRecruiterOnboarding} onChange={vi.fn()} {...props} />);

describe('MatchingStep', () => {
  it('rend les trois axes de matching et la fourchette de salaire', () => {
    renderStep();

    expect(screen.getByRole('radiogroup', { name: 'Type de contrat' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Expérience requise' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Télétravail' })).toBeInTheDocument();
    expect(screen.getByLabelText('Salaire minimum (€ brut / an)')).toBeInTheDocument();
    expect(screen.getByLabelText('Salaire maximum (€ brut / an)')).toBeInTheDocument();
  });

  it('coche les valeurs déjà sélectionnées', () => {
    renderStep({
      state: {
        ...emptyRecruiterOnboarding,
        contractType: 'CDI',
        minExperienceLevel: 'SENIOR',
        remotePolicy: 'HYBRID',
      },
    });

    expect(screen.getByRole('radio', { name: 'CDI' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Senior' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Hybride' })).toBeChecked();
  });

  it.each([
    ['Alternance', 'contractType', 'ALTERNANCE'],
    ['Confirmé', 'minExperienceLevel', 'CONFIRME'],
    ['Full remote', 'remotePolicy', 'FULL_REMOTE'],
  ])('remonte le choix %s', async (label, field, value) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ onChange });

    await user.click(screen.getByRole('radio', { name: label }));

    expect(onChange).toHaveBeenCalledWith({ [field]: value });
  });

  it('remonte les bornes de salaire saisies', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ onChange });

    await user.type(screen.getByLabelText('Salaire minimum (€ brut / an)'), '4');
    await user.type(screen.getByLabelText('Salaire maximum (€ brut / an)'), '5');

    expect(onChange).toHaveBeenCalledWith({ salaryMin: '4' });
    expect(onChange).toHaveBeenCalledWith({ salaryMax: '5' });
  });
});
