import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cityControllerSearch, sectorControllerFindAll } from '@/api/generated';
import { CompanyStep } from './CompanyStep';
import { WIZARD_ERROR_ID } from '@/components/wizard/wizardError';
import { emptyRecruiterOnboarding } from '../state';

vi.mock('@/api/generated', () => ({
  sectorControllerFindAll: vi.fn(),
  cityControllerSearch: vi.fn(),
}));

const findAll = vi.mocked(sectorControllerFindAll);
const searchCities = vi.mocked(cityControllerSearch);

const renderStep = (props: Partial<Parameters<typeof CompanyStep>[0]> = {}) =>
  render(<CompanyStep state={emptyRecruiterOnboarding} onChange={vi.fn()} {...props} />);

describe('CompanyStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findAll.mockResolvedValue({
      data: [{ id: 4, label: 'Informatique & Numérique' }],
      status: 200,
      headers: new Headers(),
    } as Awaited<ReturnType<typeof sectorControllerFindAll>>);
    searchCities.mockResolvedValue({
      data: [{ name: 'Lyon', postalCode: '69001', latitude: 45.758, longitude: 4.835 }],
      status: 200,
      headers: new Headers(),
    } as Awaited<ReturnType<typeof cityControllerSearch>>);
  });

  it('rend les champs de la société', () => {
    renderStep();

    expect(screen.getByLabelText('Nom de la société')).toBeInTheDocument();
    expect(screen.getByLabelText('Secteur')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Taille' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Ville' })).toBeInTheDocument();
    expect(screen.getByLabelText('Site web (optionnel)')).toBeInTheDocument();
  });

  // The pair and its coordinates come from the city reference, never typed:
  // that is what keeps « Lyon 690 » out of the company record.
  it('remonte la commune choisie avec son code postal', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ onChange });

    await user.type(screen.getByRole('combobox', { name: 'Ville' }), 'lyon');
    await user.click(await screen.findByRole('option', { name: 'Lyon (69001)' }));

    expect(onChange).toHaveBeenCalledWith({
      city: 'Lyon',
      postalCode: '69001',
    });
  });

  it('oublie la commune de la société dès que la saisie reprend', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({
      state: { ...emptyRecruiterOnboarding, city: 'Lyon', postalCode: '69001' },
      onChange,
    });

    await user.type(screen.getByRole('combobox', { name: 'Ville' }), 'x');

    expect(onChange).toHaveBeenCalledWith({
      city: '',
      postalCode: '',
    });
  });

  it('remonte le secteur choisi', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ onChange });
    await waitFor(() => expect(screen.getByLabelText('Secteur')).toBeEnabled());

    await user.selectOptions(screen.getByLabelText('Secteur'), '4');

    expect(onChange).toHaveBeenCalledWith({ sectorId: '4' });
  });

  it('marque le secteur quand c’est lui qui manque', async () => {
    renderStep({ invalidField: 'sectorId' });
    await waitFor(() => expect(screen.getByLabelText('Secteur')).toBeEnabled());

    expect(screen.getByLabelText('Secteur')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Secteur')).toHaveAttribute('aria-describedby', WIZARD_ERROR_ID);
  });

  it('coche la taille déjà sélectionnée', () => {
    renderStep({ state: { ...emptyRecruiterOnboarding, size: 'TPE' } });

    expect(screen.getByRole('radio', { name: 'TPE' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'PME' })).not.toBeChecked();
  });

  // Rekr targets small and mid-sized service companies.
  it('ne propose que les tailles TPE et PME', () => {
    renderStep();

    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
      'TPE',
      'PME',
    ]);
  });

  it('marque le groupe de tailles quand c’est lui qui manque', () => {
    renderStep({ invalidField: 'size' });

    const group = screen.getByRole('radiogroup', { name: 'Taille' });
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAttribute('aria-describedby', WIZARD_ERROR_ID);
  });

  it('remonte la taille choisie', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ onChange });

    await user.click(screen.getByRole('radio', { name: 'PME' }));

    expect(onChange).toHaveBeenCalledWith({ size: 'PME' });
  });

  it.each([
    ['Nom de la société', 'companyName'],
    ['Site web (optionnel)', 'siteUrl'],
  ])('remonte la saisie du champ %s', async (label, field) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ onChange });

    await user.type(screen.getByLabelText(label), 'A');

    expect(onChange).toHaveBeenCalledWith({ [field]: 'A' });
  });
});
