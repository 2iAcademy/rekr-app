import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OptionCards } from './OptionCards';

// Local fixtures: this is a shared component, it must not follow the business
// options of any one feature.
const SIZES = [
  { value: 'S', label: 'Petit' },
  { value: 'M', label: 'Moyen' },
  { value: 'L', label: 'Grand' },
] as const;

const renderCards = (props: Partial<Parameters<typeof OptionCards>[0]> = {}) =>
  render(
    <OptionCards
      legend="Taille"
      name="size"
      options={SIZES}
      value=""
      onChange={vi.fn()}
      {...props}
    />,
  );

describe('OptionCards', () => {
  it('rend une carte par option, groupées sous leur intitulé', () => {
    renderCards();

    expect(screen.getByRole('radiogroup', { name: 'Taille' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(SIZES.length);
    expect(screen.getByRole('radio', { name: 'Grand' })).toBeInTheDocument();
  });

  it('ne coche aucune option quand la valeur est vide', () => {
    renderCards();

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).not.toBeChecked();
    }
  });

  it('coche uniquement l’option sélectionnée', () => {
    renderCards({ value: 'M' });

    expect(screen.getByRole('radio', { name: 'Moyen' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Petit' })).not.toBeChecked();
  });

  // Shared with SignupPage's role selector, whose cards carry a subtitle.
  it('affiche la description d’une option quand elle en a une', () => {
    render(
      <OptionCards
        legend="Je suis"
        name="role"
        options={[
          { value: 'candidate', label: 'Candidat', description: 'Je cherche un poste' },
          { value: 'recruiter', label: 'Recruteur', description: 'Je recrute' },
        ]}
        value="candidate"
        onChange={vi.fn()}
        columns={2}
      />,
    );

    expect(screen.getByText('Je cherche un poste')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Recruteur/ })).toBeInTheDocument();
  });

  it('remonte la valeur choisie au clic', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderCards({ onChange });

    await user.click(screen.getByRole('radio', { name: 'Grand' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('L');
  });
});
