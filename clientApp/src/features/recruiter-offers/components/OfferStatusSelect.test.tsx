import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OFFER_STATUSES, offerStatusLabel } from '@/domain/offerStatus';
import { OfferStatusSelect } from './OfferStatusSelect';

const renderSelect = (props: Partial<React.ComponentProps<typeof OfferStatusSelect>> = {}) => {
  const onChange = vi.fn();
  render(
    <OfferStatusSelect
      value="draft"
      offerTitle="Développeuse backend"
      onChange={onChange}
      {...props}
    />,
  );

  return { onChange };
};

describe('OfferStatusSelect', () => {
  it('porte un nom accessible qui nomme l’offre concernée', () => {
    renderSelect();

    expect(
      screen.getByRole('combobox', { name: 'Statut de l’offre Développeuse backend' }),
    ).toBeInTheDocument();
  });

  /** No state machine backs the status, so every value stays reachable from
   * every other one — including going back to `draft`. */
  it('propose les cinq statuts, quel que soit le statut courant', () => {
    renderSelect({ value: 'closed' });

    const options = screen.getAllByRole('option').map((option) => option.textContent);

    expect(options).toEqual(OFFER_STATUSES.map(offerStatusLabel));
  });

  it('affiche le statut courant comme valeur sélectionnée', () => {
    renderSelect({ value: 'paused' });

    expect(screen.getByRole('combobox')).toHaveValue('paused');
  });

  it('remonte le statut choisi', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect();

    await user.selectOptions(screen.getByRole('combobox'), 'open');

    expect(onChange).toHaveBeenCalledWith('open');
  });

  it('se désactive pendant l’enregistrement', () => {
    renderSelect({ disabled: true });

    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
