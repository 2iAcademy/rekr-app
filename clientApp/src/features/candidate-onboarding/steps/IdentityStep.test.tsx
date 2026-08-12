import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cityControllerSearch } from '@/api/generated';
import { WIZARD_ERROR_ID } from '@/components/wizard/wizardError';
import { IdentityStep } from './IdentityStep';
import { emptyCandidateOnboarding } from '../state';

vi.mock('@/api/generated', () => ({ cityControllerSearch: vi.fn() }));

const search = vi.mocked(cityControllerSearch);

const renderStep = (props: Partial<Parameters<typeof IdentityStep>[0]> = {}) =>
  render(<IdentityStep state={emptyCandidateOnboarding} onChange={vi.fn()} {...props} />);

describe('IdentityStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    search.mockResolvedValue({
      data: [{ name: 'Lyon', postalCode: '69001', latitude: 45.758, longitude: 4.835 }],
      status: 200,
      headers: new Headers(),
    } as Awaited<ReturnType<typeof cityControllerSearch>>);
  });

  it('rend l’identité et la localisation du candidat', () => {
    renderStep();

    expect(screen.getByLabelText('Prénom')).toBeInTheDocument();
    expect(screen.getByLabelText('Nom')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Ville' })).toBeInTheDocument();
  });

  // `aria-required` rather than `required`: the native constraint would fire the
  // browser bubble before the per-step validation, hiding its business message.
  it('signale les champs obligatoires aux technologies d’assistance', () => {
    renderStep();

    for (const label of ['Prénom', 'Nom']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-required', 'true');
    }
    expect(screen.getByRole('combobox', { name: 'Ville' })).toHaveAttribute(
      'aria-required',
      'true',
    );
    expect(screen.getByLabelText('Prénom')).not.toHaveAttribute('required');
  });

  it('marque le champ désigné comme fautif et le relie au message d’erreur', () => {
    renderStep({ invalidField: 'lastName' });

    const invalid = screen.getByLabelText('Nom');
    expect(invalid).toHaveAttribute('aria-invalid', 'true');
    expect(invalid).toHaveAttribute('aria-describedby', WIZARD_ERROR_ID);
  });

  it('marque la commune fautive et la relie au message d’erreur', () => {
    renderStep({ invalidField: 'city' });

    const city = screen.getByRole('combobox', { name: 'Ville' });
    expect(city).toHaveAttribute('aria-invalid', 'true');
    expect(city).toHaveAttribute('aria-describedby', expect.stringContaining(WIZARD_ERROR_ID));
  });

  it('affiche les valeurs déjà saisies', () => {
    renderStep({
      state: {
        ...emptyCandidateOnboarding,
        firstName: 'Ada',
        city: 'Lyon',
        postalCode: '69001',
      },
    });

    expect(screen.getByLabelText('Prénom')).toHaveValue('Ada');
    expect(screen.getByRole('combobox', { name: 'Ville' })).toHaveValue('Lyon (69001)');
  });

  // The whole point of the reference: the pair and its coordinates are written
  // together, so « Lyon 690 » cannot reach the state at all.
  it('écrit la commune et son code postal d’un seul geste', async () => {
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

  it('efface la localisation dès que la commune est retapée', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({
      state: { ...emptyCandidateOnboarding, city: 'Lyon', postalCode: '69001' },
      onChange,
    });

    await user.type(screen.getByRole('combobox', { name: 'Ville' }), 'x');

    expect(onChange).toHaveBeenCalledWith({
      city: '',
      postalCode: '',
    });
  });

  it.each([
    ['Prénom', 'firstName'],
    ['Nom', 'lastName'],
  ])('remonte la saisie du champ %s', async (label, field) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ onChange });

    await user.type(screen.getByLabelText(label), '1');

    expect(onChange).toHaveBeenCalledWith({ [field]: '1' });
  });
});
