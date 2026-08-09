import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WIZARD_ERROR_ID } from '@/components/wizard/wizardError';
import { PreferencesStep } from './PreferencesStep';
import { emptyCandidateOnboarding } from '../state';

const renderStep = (props: Partial<Parameters<typeof PreferencesStep>[0]> = {}) =>
  render(<PreferencesStep state={emptyCandidateOnboarding} onChange={vi.fn()} {...props} />);

describe('PreferencesStep', () => {
  it('rend le télétravail, la mobilité et les prétentions salariales', () => {
    renderStep();

    expect(screen.getByRole('radiogroup', { name: 'Télétravail' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Mobilité' })).toBeInTheDocument();
    expect(screen.getByLabelText('Salaire minimum (€ brut / an)')).toBeInTheDocument();
    expect(screen.getByLabelText('Salaire maximum (€ brut / an)')).toBeInTheDocument();
  });

  it('remonte la préférence de télétravail', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ onChange });

    await user.click(screen.getByRole('radio', { name: 'Full remote' }));

    expect(onChange).toHaveBeenCalledWith({ remotePolicy: 'FULL_REMOTE' });
  });

  it('ne demande aucun rayon pour une mobilité nationale', () => {
    renderStep({ state: { ...emptyCandidateOnboarding, mobilityScope: 'NATIONWIDE' } });

    expect(screen.queryByLabelText('Rayon de mobilité (km)')).not.toBeInTheDocument();
  });

  it('demande un rayon quand la mobilité est limitée à une distance', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ state: { ...emptyCandidateOnboarding, mobilityScope: 'RADIUS' }, onChange });

    await user.type(screen.getByLabelText('Rayon de mobilité (km)'), '3');

    expect(onChange).toHaveBeenCalledWith({ mobilityRadiusKm: '3' });
  });

  it('ignore les caractères non numériques dans le rayon', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ state: { ...emptyCandidateOnboarding, mobilityScope: 'RADIUS' }, onChange });

    await user.type(screen.getByLabelText('Rayon de mobilité (km)'), 'a');

    expect(onChange).toHaveBeenCalledWith({ mobilityRadiusKm: '' });
  });

  it('remonte les prétentions salariales', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ onChange });

    await user.type(screen.getByLabelText('Salaire minimum (€ brut / an)'), '4');

    expect(onChange).toHaveBeenCalledWith({ salaryMin: '4' });
  });

  it('marque le groupe fautif et le relie au message d’erreur', () => {
    renderStep({ invalidField: 'mobilityScope' });

    const group = screen.getByRole('radiogroup', { name: 'Mobilité' });
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAttribute('aria-describedby', WIZARD_ERROR_ID);
  });
});
