import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { sectorControllerFindAll } from '@/api/generated';
import { CompanyStep } from './CompanyStep';
import { WIZARD_ERROR_ID } from './stepProps';
import { emptyRecruiterOnboarding } from '../state';

vi.mock('@/api/generated', () => ({ sectorControllerFindAll: vi.fn() }));

const findAll = vi.mocked(sectorControllerFindAll);

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
  });

  it('rend les champs de la société', () => {
    renderStep();

    expect(screen.getByLabelText('Nom de la société')).toBeInTheDocument();
    expect(screen.getByLabelText('Secteur')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Taille' })).toBeInTheDocument();
    expect(screen.getByLabelText('Ville')).toBeInTheDocument();
    expect(screen.getByLabelText('Code postal')).toBeInTheDocument();
    expect(screen.getByLabelText('Site web (optionnel)')).toBeInTheDocument();
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
    ['Ville', 'city'],
    ['Code postal', 'postalCode'],
    ['Site web (optionnel)', 'siteUrl'],
  ])('remonte la saisie du champ %s', async (label, field) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ onChange });

    await user.type(screen.getByLabelText(label), 'A');

    expect(onChange).toHaveBeenCalledWith({ [field]: 'A' });
  });
});
