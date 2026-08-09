import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagInput } from './TagInput';
import { MAX_TAGS } from '@/lib/bounds';

const renderTags = (props: Partial<Parameters<typeof TagInput>[0]> = {}) =>
  render(
    <TagInput
      label="Compétences recherchées"
      placeholder="React"
      values={[]}
      onChange={vi.fn()}
      {...props}
    />,
  );

describe('TagInput', () => {
  it('ajoute la saisie validée à la liste', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderTags({ onChange });

    await user.type(screen.getByLabelText('Compétences recherchées'), 'React{Enter}');

    expect(onChange).toHaveBeenCalledWith(['React']);
  });

  it('vide le champ après un ajout', async () => {
    const user = userEvent.setup();
    renderTags();

    const field = screen.getByLabelText('Compétences recherchées');
    await user.type(field, 'React{Enter}');

    expect(field).toHaveValue('');
  });

  /**
   * Labels land in the shared `Tag` table, where `anglais` and `Anglais` would
   * become two distinct entries. Capitalising on the way in keeps that
   * reference table clean and the chips visually consistent.
   */
  it('met une majuscule à la première lettre', async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    renderTags({ onChange });

    await user.type(screen.getByLabelText('Compétences recherchées'), 'esprit d’équipe{Enter}');

    expect(onChange).toHaveBeenCalledWith(['Esprit d’équipe']);
  });

  it('ne touche pas au reste du libellé', async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    renderTags({ onChange });

    await user.type(
      screen.getByLabelText('Compétences recherchées'),
      'ticket restaurant 9€{Enter}',
    );

    expect(onChange).toHaveBeenCalledWith(['Ticket restaurant 9€']);
  });

  it('gère les lettres accentuées', async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    renderTags({ onChange });

    await user.type(screen.getByLabelText('Compétences recherchées'), 'école de commerce{Enter}');

    expect(onChange).toHaveBeenCalledWith(['École de commerce']);
  });

  it('laisse tel quel un libellé qui ne commence pas par une lettre', async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    renderTags({ onChange });

    await user.type(screen.getByLabelText('Compétences recherchées'), '35h par semaine{Enter}');

    expect(onChange).toHaveBeenCalledWith(['35h par semaine']);
  });

  it('détecte le doublon malgré la mise en majuscule', async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    renderTags({ values: ['Anglais'], onChange });

    await user.type(screen.getByLabelText('Compétences recherchées'), 'anglais{Enter}');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('supprime les espaces superflus autour de la saisie', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderTags({ onChange });

    await user.type(screen.getByLabelText('Compétences recherchées'), '  React  {Enter}');

    expect(onChange).toHaveBeenCalledWith(['React']);
  });

  it('ignore une saisie vide ou composée d’espaces', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderTags({ onChange });

    await user.type(screen.getByLabelText('Compétences recherchées'), '   {Enter}');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('refuse un doublon, quelle que soit la casse', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderTags({ values: ['React'], onChange });

    await user.type(screen.getByLabelText('Compétences recherchées'), 'react{Enter}');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('ne soumet pas le formulaire quand on valide un tag', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <TagInput label="Compétences recherchées" values={[]} onChange={vi.fn()} />
      </form>,
    );

    await user.type(screen.getByLabelText('Compétences recherchées'), 'React{Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('affiche les tags existants et permet de les retirer', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderTags({ values: ['React', 'TypeScript'], onChange });

    expect(screen.getByText('React')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retirer React' }));

    expect(onChange).toHaveBeenCalledWith(['TypeScript']);
  });

  // The placeholders advertise comma-separated input ("React, TypeScript…"), so
  // a single tag carrying a comma would land in the shared `Tag` table as-is.
  it('découpe une saisie séparée par des virgules', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderTags({ onChange });

    await user.type(screen.getByLabelText('Compétences recherchées'), 'React, TypeScript{Enter}');

    expect(onChange).toHaveBeenCalledWith(['React', 'TypeScript']);
  });

  it('ignore les doublons internes et les fragments vides d’une saisie découpée', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderTags({ values: ['React'], onChange });

    await user.type(screen.getByLabelText('Compétences recherchées'), 'Vue, ,react, Vue{Enter}');

    expect(onChange).toHaveBeenCalledWith(['React', 'Vue']);
  });

  // Clicking "Continuer" blurs the field; without this the typed skill would be
  // dropped and the step would wrongly report "au moins une compétence".
  it('ajoute la saisie en cours quand le champ perd le focus', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderTags({ onChange });

    await user.type(screen.getByLabelText('Compétences recherchées'), 'React');
    await user.tab();

    expect(onChange).toHaveBeenCalledWith(['React']);
  });

  it('n’ajoute rien quand un champ vide perd le focus', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderTags({ onChange });

    await user.click(screen.getByLabelText('Compétences recherchées'));
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('efface le message de limite dès qu’un tag est retiré', async () => {
    const user = userEvent.setup();
    const saturated = Array.from({ length: MAX_TAGS }, (_, index) => `Compétence ${index}`);
    const { rerender } = renderTags({ values: saturated });

    await user.type(screen.getByLabelText('Compétences recherchées'), 'React{Enter}');
    expect(screen.getByRole('alert')).toBeInTheDocument();

    rerender(
      <TagInput
        label="Compétences recherchées"
        placeholder="React"
        values={saturated.slice(1)}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('bloque l’ajout au-delà de la limite et l’explique', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const saturated = Array.from({ length: MAX_TAGS }, (_, index) => `Compétence ${index}`);
    renderTags({ values: saturated, onChange });

    await user.type(screen.getByLabelText('Compétences recherchées'), 'React{Enter}');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(`Maximum ${MAX_TAGS} éléments.`);
  });
});
