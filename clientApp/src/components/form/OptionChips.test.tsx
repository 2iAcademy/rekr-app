import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OptionChips } from './OptionChips';

// Local fixtures: this is a shared component, it must not follow the business
// options of any one feature.
const SIZES = [
  { value: 'S', label: 'Petit' },
  { value: 'M', label: 'Moyen' },
  { value: 'L', label: 'Grand' },
] as const;

const renderChips = (props: Partial<Parameters<typeof OptionChips>[0]> = {}) =>
  render(
    <OptionChips
      legend="Tailles acceptées"
      name="sizes"
      options={SIZES}
      values={[]}
      onChange={vi.fn()}
      {...props}
    />,
  );

describe('OptionChips', () => {
  it('rend une case par option, groupées sous leur intitulé', () => {
    renderChips();

    expect(screen.getByRole('group', { name: 'Tailles acceptées' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(SIZES.length);
  });

  it('coche toutes les options retenues', () => {
    renderChips({ values: ['S', 'L'] });

    expect(screen.getByRole('checkbox', { name: 'Petit' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Grand' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Moyen' })).not.toBeChecked();
  });

  it('ajoute une option au clic sans perdre les précédentes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderChips({ values: ['S'], onChange });

    await user.click(screen.getByRole('checkbox', { name: 'Grand' }));

    expect(onChange).toHaveBeenCalledWith(['S', 'L']);
  });

  it('retire une option déjà retenue au second clic', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderChips({ values: ['S', 'L'], onChange });

    await user.click(screen.getByRole('checkbox', { name: 'Petit' }));

    expect(onChange).toHaveBeenCalledWith(['L']);
  });

  // The order of the options is what the candidate reads; a selection rebuilt
  // from click order would send `['FREELANCE', 'CDI']` and read back shuffled.
  it('conserve l’ordre des options quelle que soit celui des clics', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderChips({ values: ['L'], onChange });

    await user.click(screen.getByRole('checkbox', { name: 'Petit' }));

    expect(onChange).toHaveBeenCalledWith(['S', 'L']);
  });

  it('signale le groupe en erreur et pointe vers son message', () => {
    renderChips({ invalid: true, describedBy: 'wizard-error' });

    const group = screen.getByRole('group', { name: 'Tailles acceptées' });
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAttribute('aria-describedby', 'wizard-error');
  });
});
