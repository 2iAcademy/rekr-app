import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CultureStep } from './CultureStep';
import { emptyRecruiterOnboarding } from '../state';

const renderStep = (props: Partial<Parameters<typeof CultureStep>[0]> = {}) =>
  render(<CultureStep state={emptyRecruiterOnboarding} onChange={vi.fn()} {...props} />);

describe('CultureStep', () => {
  it('rend la présentation de la société', () => {
    renderStep();

    expect(screen.getByLabelText('Présentation de la société')).toBeInTheDocument();
  });

  it('remonte la présentation saisie', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ onChange });

    await user.type(screen.getByLabelText('Présentation de la société'), 'O');

    expect(onChange).toHaveBeenCalledWith({ description: 'O' });
  });

  // Les avantages varient d'un poste à l'autre : ils se saisissent sur l'offre,
  // à l'étape suivante, et n'ont plus rien à faire sur la fiche société.
  it("ne propose plus les avantages, qui appartiennent à l'offre", () => {
    renderStep({ state: { ...emptyRecruiterOnboarding, benefits: ['Mutuelle'] } });

    expect(screen.queryByLabelText('Avantages (optionnel)')).not.toBeInTheDocument();
    expect(screen.queryByText('Mutuelle')).not.toBeInTheDocument();
  });
});
