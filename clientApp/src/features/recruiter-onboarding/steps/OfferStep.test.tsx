import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cityControllerSearch } from '@/api/generated';
import { OfferStep } from './OfferStep';
import { emptyRecruiterOnboarding } from '../state';

vi.mock('@/api/generated', () => ({ cityControllerSearch: vi.fn() }));

const searchCities = vi.mocked(cityControllerSearch);

const renderStep = (props: Partial<Parameters<typeof OfferStep>[0]> = {}) =>
  render(<OfferStep state={emptyRecruiterOnboarding} onChange={vi.fn()} {...props} />);

describe('OfferStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchCities.mockResolvedValue({
      data: [{ name: 'Lyon', postalCode: '69003', latitude: 45.751, longitude: 4.869 }],
      status: 200,
      headers: new Headers(),
    } as Awaited<ReturnType<typeof cityControllerSearch>>);
  });

  it('rend les champs de la première offre', () => {
    renderStep();

    expect(screen.getByLabelText('Titre du poste')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Ville du poste' })).toBeInTheDocument();
    expect(screen.getByLabelText('Missions')).toBeInTheDocument();
    expect(screen.getByLabelText('Compétences recherchées')).toBeInTheDocument();
  });

  // The location is pre-filled from the company, so the field must open on the
  // inherited commune rather than on an empty box.
  it('affiche la localisation reprise de la société', () => {
    renderStep({
      state: { ...emptyRecruiterOnboarding, offerCity: 'Lyon', offerPostalCode: '69003' },
    });

    expect(screen.getByRole('combobox', { name: 'Ville du poste' })).toHaveValue('Lyon (69003)');
  });

  it('remonte la commune choisie avec son code postal', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ onChange });

    await user.type(screen.getByRole('combobox', { name: 'Ville du poste' }), 'lyon');
    await user.click(await screen.findByRole('option', { name: 'Lyon (69003)' }));

    expect(onChange).toHaveBeenCalledWith({
      offerCity: 'Lyon',
      offerPostalCode: '69003',
    });
  });

  it('oublie la commune du poste dès que la saisie reprend', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({
      state: { ...emptyRecruiterOnboarding, offerCity: 'Lyon', offerPostalCode: '69003' },
      onChange,
    });

    await user.type(screen.getByRole('combobox', { name: 'Ville du poste' }), 'x');

    expect(onChange).toHaveBeenCalledWith({
      offerCity: '',
      offerPostalCode: '',
    });
  });

  it.each([
    ['Titre du poste', 'offerTitle'],
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
