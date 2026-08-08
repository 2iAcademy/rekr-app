import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CultureStep } from './CultureStep';
import { emptyRecruiterOnboarding } from '../state';

const renderStep = (props: Partial<Parameters<typeof CultureStep>[0]> = {}) =>
  render(<CultureStep state={emptyRecruiterOnboarding} onChange={vi.fn()} {...props} />);

describe('CultureStep', () => {
  it('rend la présentation et les avantages', () => {
    renderStep();

    expect(screen.getByLabelText('Présentation de la société')).toBeInTheDocument();
    expect(screen.getByLabelText('Avantages (optionnel)')).toBeInTheDocument();
  });

  it('remonte la présentation saisie', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ onChange });

    await user.type(screen.getByLabelText('Présentation de la société'), 'O');

    expect(onChange).toHaveBeenCalledWith({ description: 'O' });
  });

  it('affiche les avantages déjà ajoutés', () => {
    renderStep({ state: { ...emptyRecruiterOnboarding, benefits: ['Mutuelle'] } });

    expect(screen.getByText('Mutuelle')).toBeInTheDocument();
  });

  it('remonte un avantage ajouté', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ onChange });

    await user.type(screen.getByLabelText('Avantages (optionnel)'), 'Tickets resto{Enter}');

    expect(onChange).toHaveBeenCalledWith({ benefits: ['Tickets resto'] });
  });
});
