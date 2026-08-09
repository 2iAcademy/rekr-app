import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WIZARD_ERROR_ID } from '@/components/wizard/wizardError';
import { ProjectStep } from './ProjectStep';
import { emptyCandidateOnboarding } from '../state';

const renderStep = (props: Partial<Parameters<typeof ProjectStep>[0]> = {}) =>
  render(<ProjectStep state={emptyCandidateOnboarding} onChange={vi.fn()} {...props} />);

describe('ProjectStep', () => {
  it('rend le poste recherché et les critères du projet', () => {
    renderStep();

    expect(screen.getByLabelText('Poste recherché')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Type(s) de contrat' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Niveau d’expérience' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Disponibilité' })).toBeInTheDocument();
  });

  it('permet de retenir plusieurs types de contrat', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ state: { ...emptyCandidateOnboarding, contractTypes: ['CDI'] }, onChange });

    await user.click(screen.getByRole('checkbox', { name: 'Freelance' }));

    expect(onChange).toHaveBeenCalledWith({ contractTypes: ['CDI', 'FREELANCE'] });
  });

  it('remonte le niveau d’expérience choisi', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ onChange });

    await user.click(screen.getByRole('radio', { name: 'Senior' }));

    expect(onChange).toHaveBeenCalledWith({ experienceLevel: 'SENIOR' });
  });

  // The companion field belongs to one answer only: showing all three at once
  // would ask the candidate to fill a delay they have just replaced by a date.
  it('n’affiche aucun complément pour une disponibilité immédiate', () => {
    renderStep({ state: { ...emptyCandidateOnboarding, availability: 'IMMEDIATE' } });

    expect(screen.queryByLabelText('Disponible dans (mois)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Date de disponibilité')).not.toBeInTheDocument();
  });

  it('demande un délai en mois pour une disponibilité sous délai', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({
      state: { ...emptyCandidateOnboarding, availability: 'WITHIN_DELAY' },
      onChange,
    });

    const delay = screen.getByLabelText('Disponible dans (mois)');
    expect(screen.queryByLabelText('Date de disponibilité')).not.toBeInTheDocument();

    await user.type(delay, '3');

    expect(onChange).toHaveBeenCalledWith({ availabilityDelayMonths: '3' });
  });

  it('ignore les caractères non numériques dans le délai', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({
      state: { ...emptyCandidateOnboarding, availability: 'WITHIN_DELAY' },
      onChange,
    });

    await user.type(screen.getByLabelText('Disponible dans (mois)'), 'a');

    expect(onChange).toHaveBeenCalledWith({ availabilityDelayMonths: '' });
  });

  it('demande une date pour une disponibilité à date précise', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({
      state: { ...emptyCandidateOnboarding, availability: 'SPECIFIC_DATE' },
      onChange,
    });

    expect(screen.queryByLabelText('Disponible dans (mois)')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Date de disponibilité'), '2026-09-01');

    expect(onChange).toHaveBeenCalledWith({ availabilityDate: '2026-09-01' });
  });

  it('marque le groupe fautif et le relie au message d’erreur', () => {
    renderStep({ invalidField: 'contractTypes' });

    const group = screen.getByRole('group', { name: 'Type(s) de contrat' });
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAttribute('aria-describedby', WIZARD_ERROR_ID);
  });
});
