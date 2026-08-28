import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cityControllerSearch } from '@/api/generated';
import type { OfferFormValue } from '@/features/recruiter-offers/offerPayload';
import type { OfferFormError } from '@/features/recruiter-offers/offerValidation';
import { OfferForm } from './OfferForm';

vi.mock('@/api/generated', () => ({
  cityControllerSearch: vi.fn(),
}));

const searchCities = vi.mocked(cityControllerSearch);

const answer = (data: unknown) =>
  ({ data, status: 200, headers: new Headers() }) as unknown as Awaited<
    ReturnType<typeof cityControllerSearch>
  >;

const filled: OfferFormValue = {
  title: 'Développeuse Front',
  description: 'Vous construirez le design system.',
  city: 'Lyon',
  postalCode: '69003',
  skills: ['React'],
  contractType: 'CDI',
  minExperienceLevel: 'CONFIRME',
  remotePolicy: 'HYBRID',
  salaryMin: '45000',
  salaryMax: '55000',
  status: 'open',
};

const renderForm = (
  overrides: Partial<Parameters<typeof OfferForm>[0]> = {},
): { onChange: ReturnType<typeof vi.fn>; onSubmit: ReturnType<typeof vi.fn> } => {
  const onChange = vi.fn();
  const onSubmit = vi.fn();

  render(
    <OfferForm
      value={filled}
      onChange={onChange}
      onSubmit={onSubmit}
      submitting={false}
      submitLabel="Enregistrer"
      error={null}
      {...overrides}
    />,
  );

  return { onChange, onSubmit };
};

/** The message is the one alert of the form, so the link is checked by role. */
const isDescribedByTheAlert = (element: HTMLElement): boolean =>
  (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .some((id) => document.getElementById(id)?.getAttribute('role') === 'alert');

describe('OfferForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchCities.mockResolvedValue(answer([]));
  });

  it('affiche les valeurs reçues dans chaque champ', () => {
    renderForm();

    expect(screen.getByRole('textbox', { name: 'Titre du poste' })).toHaveValue(
      'Développeuse Front',
    );
    expect(screen.getByRole('combobox', { name: 'Ville du poste' })).toHaveValue('Lyon (69003)');
    expect(screen.getByRole('textbox', { name: 'Salaire minimum (€ brut / an)' })).toHaveValue(
      '45000',
    );
    expect(screen.getByRole('textbox', { name: 'Salaire maximum (€ brut / an)' })).toHaveValue(
      '55000',
    );
    expect(screen.getByRole('radio', { name: 'CDI' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Confirmé' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Hybride' })).toBeChecked();
  });

  it('affiche les compétences déjà retenues', () => {
    renderForm();

    expect(screen.getByRole('button', { name: 'Retirer React' })).toBeInTheDocument();
  });

  it('propose les cinq statuts du cycle de vie et coche celui de l’offre', () => {
    renderForm();

    const statuses = screen.getByRole('radiogroup', { name: 'Statut de l’offre' });

    expect(statuses).toBeInTheDocument();
    for (const label of ['Brouillon', 'Publiée', 'En pause', 'Pourvue', 'Fermée']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('radio', { name: 'Publiée' })).toBeChecked();
  });

  it('remonte la saisie du titre', async () => {
    const user = userEvent.setup();
    const { onChange } = renderForm({ value: { ...filled, title: '' } });

    await user.type(screen.getByRole('textbox', { name: 'Titre du poste' }), 'D');

    expect(onChange).toHaveBeenCalledWith({ title: 'D' });
  });

  it('remonte le changement de statut', async () => {
    const user = userEvent.setup();
    const { onChange } = renderForm();

    await user.click(screen.getByRole('radio', { name: 'En pause' }));

    expect(onChange).toHaveBeenCalledWith({ status: 'paused' });
  });

  it('remonte le changement de type de contrat', async () => {
    const user = userEvent.setup();
    const { onChange } = renderForm();

    await user.click(screen.getByRole('radio', { name: 'Alternance' }));

    expect(onChange).toHaveBeenCalledWith({ contractType: 'ALTERNANCE' });
  });

  it('écrit la ville et le code postal ensemble', async () => {
    const user = userEvent.setup();
    searchCities.mockResolvedValue(
      answer([{ name: 'Marseille', postalCode: '13001', latitude: 43.3, longitude: 5.4 }]),
    );
    const { onChange } = renderForm();

    await user.clear(screen.getByRole('combobox', { name: 'Ville du poste' }));
    await user.type(screen.getByRole('combobox', { name: 'Ville du poste' }), 'Marseille');
    await user.click(await screen.findByRole('option', { name: 'Marseille (13001)' }));

    expect(onChange).toHaveBeenCalledWith({ city: 'Marseille', postalCode: '13001' });
  });

  it('vide la ville et le code postal ensemble', async () => {
    const user = userEvent.setup();
    const { onChange } = renderForm();

    await user.type(screen.getByRole('combobox', { name: 'Ville du poste' }), 'x');

    expect(onChange).toHaveBeenCalledWith({ city: '', postalCode: '' });
  });

  it('soumet le formulaire sans recharger la page', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('porte le libellé d’action que la page lui donne', () => {
    renderForm({ submitLabel: 'Créer l’offre' });

    expect(screen.getByRole('button', { name: 'Créer l’offre' })).toBeInTheDocument();
  });

  it('annonce l’enregistrement en cours et interdit un second envoi', () => {
    renderForm({ submitting: true });

    expect(screen.getByRole('button', { name: 'Enregistrement…' })).toBeDisabled();
  });

  it('n’affiche aucune alerte tant que la saisie est valide', () => {
    renderForm();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('signale le champ texte fautif et le relie au message', () => {
    const error: OfferFormError = { field: 'title', message: 'Renseignez le titre du poste.' };
    renderForm({ value: { ...filled, title: '' }, error });

    const title = screen.getByRole('textbox', { name: 'Titre du poste' });

    expect(screen.getByRole('alert')).toHaveTextContent('Renseignez le titre du poste.');
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(isDescribedByTheAlert(title)).toBe(true);
  });

  it('signale le groupe d’options fautif et le relie au message', () => {
    const error: OfferFormError = {
      field: 'contractType',
      message: 'Choisissez le type de contrat.',
    };
    renderForm({ value: { ...filled, contractType: '' }, error });

    const group = screen.getByRole('radiogroup', { name: 'Type de contrat' });

    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(isDescribedByTheAlert(group)).toBe(true);
  });

  it('signale la commune fautive sur le champ ville', () => {
    const error: OfferFormError = {
      field: 'city',
      message: 'Choisissez la commune du poste dans la liste.',
    };
    renderForm({ value: { ...filled, city: '', postalCode: '' }, error });

    const city = screen.getByRole('combobox', { name: 'Ville du poste' });

    expect(city).toHaveAttribute('aria-invalid', 'true');
    expect(isDescribedByTheAlert(city)).toBe(true);
  });

  it('signale les compétences manquantes sur leur champ', () => {
    const error: OfferFormError = {
      field: 'skills',
      message: 'Ajoutez au moins une compétence recherchée.',
    };
    renderForm({ value: { ...filled, skills: [] }, error });

    const skills = screen.getByRole('textbox', { name: 'Compétences recherchées' });

    expect(skills).toHaveAttribute('aria-invalid', 'true');
    expect(isDescribedByTheAlert(skills)).toBe(true);
  });

  it('signale une fourchette de salaire inversée sur le maximum', () => {
    const error: OfferFormError = {
      field: 'salaryMax',
      message: 'Le salaire maximum ne peut pas être inférieur au minimum.',
    };
    renderForm({ value: { ...filled, salaryMin: '55000', salaryMax: '45000' }, error });

    expect(
      isDescribedByTheAlert(screen.getByRole('textbox', { name: 'Salaire maximum (€ brut / an)' })),
    ).toBe(true);
  });

  it('ne marque pas les champs sains quand un autre est fautif', () => {
    renderForm({
      value: { ...filled, title: '' },
      error: { field: 'title', message: 'Renseignez le titre du poste.' },
    });

    expect(screen.getByRole('radiogroup', { name: 'Type de contrat' })).toHaveAttribute(
      'aria-invalid',
      'false',
    );
  });
});
