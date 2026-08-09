import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SalaryRange } from './SalaryRange';

const renderRange = (props: Partial<Parameters<typeof SalaryRange>[0]> = {}) =>
  render(<SalaryRange min="" max="" onMinChange={vi.fn()} onMaxChange={vi.fn()} {...props} />);

describe('SalaryRange', () => {
  it('rend un champ minimum et un champ maximum', () => {
    renderRange();

    expect(screen.getByLabelText('Salaire minimum (€ brut / an)')).toBeInTheDocument();
    expect(screen.getByLabelText('Salaire maximum (€ brut / an)')).toBeInTheDocument();
  });

  it('remonte le minimum saisi', async () => {
    const user = userEvent.setup();
    const onMinChange = vi.fn();
    renderRange({ onMinChange });

    await user.type(screen.getByLabelText('Salaire minimum (€ brut / an)'), '4');

    expect(onMinChange).toHaveBeenCalledWith('4');
  });

  it('remonte le maximum saisi', async () => {
    const user = userEvent.setup();
    const onMaxChange = vi.fn();
    renderRange({ onMaxChange });

    await user.type(screen.getByLabelText('Salaire maximum (€ brut / an)'), '5');

    expect(onMaxChange).toHaveBeenCalledWith('5');
  });

  // `parseInt('45 000')` is 45, so letting separators or symbols through would
  // silently publish a salary 1000x too low.
  it('ne conserve que les chiffres de la saisie', async () => {
    const user = userEvent.setup();
    const onMinChange = vi.fn();
    renderRange({ min: '45', onMinChange });

    await user.type(screen.getByLabelText('Salaire minimum (€ brut / an)'), ' €');

    expect(onMinChange).toHaveBeenLastCalledWith('45');
  });

  it('signale une fourchette incohérente sur le champ maximum', () => {
    renderRange({ min: '55000', max: '45000' });

    expect(screen.getByLabelText('Salaire maximum (€ brut / an)')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('ne signale rien quand la fourchette est cohérente', () => {
    renderRange({ min: '45000', max: '55000' });

    expect(screen.getByLabelText('Salaire maximum (€ brut / an)')).toHaveAttribute(
      'aria-invalid',
      'false',
    );
  });
});
