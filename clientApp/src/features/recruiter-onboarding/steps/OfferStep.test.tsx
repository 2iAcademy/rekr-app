import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OfferStep } from './OfferStep';
import { emptyRecruiterOnboarding } from '../state';

const renderStep = (props: Partial<Parameters<typeof OfferStep>[0]> = {}) =>
  render(<OfferStep state={emptyRecruiterOnboarding} onChange={vi.fn()} {...props} />);

describe('OfferStep', () => {
  it('rend les champs de la première offre', () => {
    renderStep();

    expect(screen.getByLabelText('Titre du poste')).toBeInTheDocument();
    expect(screen.getByLabelText('Ville')).toBeInTheDocument();
    expect(screen.getByLabelText('Code postal')).toBeInTheDocument();
    expect(screen.getByLabelText('Missions')).toBeInTheDocument();
    expect(screen.getByLabelText('Compétences recherchées')).toBeInTheDocument();
  });

  it('affiche la localisation reprise de la société', () => {
    renderStep({
      state: { ...emptyRecruiterOnboarding, offerCity: 'Lyon', offerPostalCode: '69003' },
    });

    expect(screen.getByLabelText('Ville')).toHaveValue('Lyon');
    expect(screen.getByLabelText('Code postal')).toHaveValue('69003');
  });

  it.each([
    ['Titre du poste', 'offerTitle'],
    ['Ville', 'offerCity'],
    ['Code postal', 'offerPostalCode'],
    ['Missions', 'offerDescription'],
  ])('remonte la saisie du champ %s', async (label, field) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ onChange });

    await user.type(screen.getByLabelText(label), 'A');

    expect(onChange).toHaveBeenCalledWith({ [field]: 'A' });
  });

  it('remonte une compétence ajoutée', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ onChange });

    await user.type(screen.getByLabelText('Compétences recherchées'), 'React{Enter}');

    expect(onChange).toHaveBeenCalledWith({ skills: ['React'] });
  });
});
