import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cityControllerSearch } from '@/api/generated';
import { CityField } from './CityField';

vi.mock('@/api/generated', () => ({ cityControllerSearch: vi.fn() }));

const search = vi.mocked(cityControllerSearch);

const answer = (cities: { name: string; postalCode: string }[]) =>
  ({
    data: cities.map((city) => ({ ...city, latitude: 45.75, longitude: 4.85 })),
    status: 200,
    headers: new Headers(),
  }) as Awaited<ReturnType<typeof cityControllerSearch>>;

const renderField = (props: Partial<Parameters<typeof CityField>[0]> = {}) =>
  render(
    <CityField
      label="Ville"
      selected={null}
      onSelect={vi.fn()}
      onClear={vi.fn()}
      debounceMs={0}
      {...props}
    />,
  );

describe('CityField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    search.mockResolvedValue(answer([{ name: 'Lyon', postalCode: '69001' }]));
  });

  it('rend un champ de saisie assisté', () => {
    renderField();

    const input = screen.getByRole('combobox', { name: 'Ville' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  // The reference refuses anything shorter, and a two-letter prefix would match
  // half of France anyway.
  it('n’interroge pas le référentiel avant trois caractères', async () => {
    const user = userEvent.setup();
    renderField();

    await user.type(screen.getByRole('combobox', { name: 'Ville' }), 'ly');

    await waitFor(() => expect(search).not.toHaveBeenCalled());
  });

  it('propose les communes trouvées à partir de trois caractères', async () => {
    const user = userEvent.setup();
    search.mockResolvedValue(
      answer([
        { name: 'Lyon', postalCode: '69001' },
        { name: 'Lyon 3e Arrondissement', postalCode: '69003' },
      ]),
    );
    renderField();

    await user.type(screen.getByRole('combobox', { name: 'Ville' }), 'lyon');

    expect(await screen.findByRole('option', { name: 'Lyon (69001)' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Lyon 3e Arrondissement (69003)' }),
    ).toBeInTheDocument();
    expect(search).toHaveBeenCalledWith({ q: 'lyon' });
  });

  // The pair and its coordinates come from the reference, never from the field:
  // that is what makes « Lyon 690 » impossible to submit.
  it('remonte la commune choisie avec son code postal et ses coordonnées', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderField({ onSelect });

    await user.type(screen.getByRole('combobox', { name: 'Ville' }), 'lyon');
    await user.click(await screen.findByRole('option', { name: 'Lyon (69001)' }));

    expect(onSelect).toHaveBeenCalledWith({
      name: 'Lyon',
      postalCode: '69001',
      latitude: 45.75,
      longitude: 4.85,
    });
  });

  it('referme la liste une fois la commune choisie', async () => {
    const user = userEvent.setup();
    renderField();

    await user.type(screen.getByRole('combobox', { name: 'Ville' }), 'lyon');
    await user.click(await screen.findByRole('option', { name: 'Lyon (69001)' }));

    await waitFor(() => expect(screen.queryByRole('option')).not.toBeInTheDocument());
    expect(screen.getByRole('combobox', { name: 'Ville' })).toHaveValue('Lyon (69001)');
  });

  it('affiche la commune déjà retenue au montage', () => {
    renderField({ selected: { name: 'Nîmes', postalCode: '30000' } });

    expect(screen.getByRole('combobox', { name: 'Ville' })).toHaveValue('Nîmes (30000)');
  });

  // Editing the text invalidates the selection: otherwise the stored city would
  // no longer be the one shown in the field.
  it('oublie la commune retenue dès que la saisie reprend', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    renderField({ selected: { name: 'Lyon', postalCode: '69001' }, onClear });

    await user.type(screen.getByRole('combobox', { name: 'Ville' }), 'x');

    expect(onClear).toHaveBeenCalled();
  });

  it('se parcourt au clavier et se choisit avec Entrée', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    search.mockResolvedValue(
      answer([
        { name: 'Lyon', postalCode: '69001' },
        { name: 'Lyon 3e Arrondissement', postalCode: '69003' },
      ]),
    );
    renderField({ onSelect });

    const input = screen.getByRole('combobox', { name: 'Ville' });
    await user.type(input, 'lyon');
    await screen.findByRole('option', { name: 'Lyon (69001)' });

    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ postalCode: '69003' }));
  });

  it('referme la liste avec Échap', async () => {
    const user = userEvent.setup();
    renderField();

    await user.type(screen.getByRole('combobox', { name: 'Ville' }), 'lyon');
    await screen.findByRole('option', { name: 'Lyon (69001)' });

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('signale une recherche sans résultat', async () => {
    const user = userEvent.setup();
    search.mockResolvedValue(answer([]));
    renderField();

    await user.type(screen.getByRole('combobox', { name: 'Ville' }), 'wakanda');

    expect(await screen.findByText('Aucune commune trouvée.')).toBeInTheDocument();
  });

  it('reste utilisable quand la recherche échoue', async () => {
    const user = userEvent.setup();
    search.mockRejectedValue(new Error('network down'));
    renderField();

    await user.type(screen.getByRole('combobox', { name: 'Ville' }), 'lyon');

    expect(await screen.findByText('Aucune commune trouvée.')).toBeInTheDocument();
  });

  it('marque le champ en erreur et le relie à son message', () => {
    renderField({ invalid: true, describedBy: 'wizard-error' });

    const input = screen.getByRole('combobox', { name: 'Ville' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('wizard-error'));
  });
});
