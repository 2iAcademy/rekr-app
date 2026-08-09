import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RichTextField } from './RichTextField';

const renderField = (props: Partial<Parameters<typeof RichTextField>[0]> = {}) =>
  render(
    <RichTextField
      label="Présentation de la société"
      value=""
      onChange={vi.fn()}
      maxLength={5000}
      {...props}
    />,
  );

const editor = () => screen.getByRole('textbox', { name: 'Présentation de la société' });

function ControlledField({ maxLength }: { maxLength: number }) {
  const [value, setValue] = useState('');

  return (
    <RichTextField
      label="Présentation de la société"
      value={value}
      onChange={setValue}
      maxLength={maxLength}
    />
  );
}

const paste = (target: HTMLElement, text: string): void => {
  const transfer = { getData: (format: string) => (format === 'text/plain' ? text : '') };
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.assign(event, { clipboardData: transfer, dataTransfer: transfer });
  target.dispatchEvent(event);
};

describe('RichTextField', () => {
  it('rend une zone éditable et ses commandes', () => {
    renderField();

    expect(editor()).toHaveAttribute('contenteditable', 'true');
    expect(screen.getByRole('button', { name: 'Gras' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Italique' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Liste à puces' })).toBeInTheDocument();
  });

  // The point of the whole component: the recruiter sees bold, not `**`.
  it('affiche la mise en forme plutôt que les marqueurs', () => {
    renderField({ value: 'Une **équipe** soudée' });

    expect(screen.getByText('équipe').tagName).toBe('STRONG');
    expect(editor().textContent).not.toContain('**');
  });

  it('affiche les puces comme une vraie liste', () => {
    renderField({ value: '- Mutuelle\n- RTT' });

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Mutuelle',
      'RTT',
    ]);
  });

  it('remonte la saisie convertie en Markdown', async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    renderField({ onChange });

    await user.click(editor());
    await user.keyboard('Bonjour');

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.lastCall?.[0]).toContain('Bonjour');
  });

  /**
   * jsdom cannot apply formatting, so these assert the command asked of the
   * browser — the component's actual contract. That the browser then produces
   * bold is verified in a real browser, not here.
   */
  it.each([
    ['Gras', 'bold'],
    ['Italique', 'italic'],
    ['Liste à puces', 'insertUnorderedList'],
  ])('demande la commande %s au navigateur', async (name, command) => {
    const user = userEvent.setup({ delay: null });
    renderField({ value: 'Une équipe' });

    await user.click(screen.getByRole('button', { name }));

    expect(document.execCommand).toHaveBeenCalledWith(command);
  });

  it.each([
    ['b', 'bold'],
    ['i', 'italic'],
  ])('applique le raccourci Ctrl+%s', async (key, command) => {
    const user = userEvent.setup({ delay: null });
    renderField({ value: 'Une équipe' });

    await user.click(editor());
    await user.keyboard(`{Control>}${key}{/Control}`);

    expect(document.execCommand).toHaveBeenCalledWith(command);
  });

  it('ignore les autres raccourcis', async () => {
    const user = userEvent.setup({ delay: null });
    renderField({ value: 'Une équipe' });

    await user.click(editor());
    await user.keyboard('{Control>}s{/Control}');

    expect(document.execCommand).not.toHaveBeenCalled();
  });

  it('tronque au-delà de la limite de caractères', async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    renderField({ onChange, maxLength: 5 });

    await user.click(editor());
    await user.keyboard('abcdefghij');

    expect(onChange.mock.lastCall?.[0]).toHaveLength(5);
  });

  /**
   * Truncating the emitted value is not enough: the editor kept displaying text
   * the state had stopped recording, so the recruiter saw a description that
   * would never be sent. The DOM has to be held at the limit too.
   */
  it('ne laisse pas la zone éditable dépasser la limite', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ControlledField maxLength={5} />);

    await user.click(editor());
    await user.keyboard('abcdefghij');

    expect(editor().textContent).toBe('abcde');
    expect(screen.getByText('0 caractères restants')).toBeInTheDocument();
  });

  it('borne le texte collé à la place restante', () => {
    const onChange = vi.fn();
    renderField({ onChange, maxLength: 5, value: 'abc' });

    paste(editor(), 'defghij');

    expect(document.execCommand).toHaveBeenCalledWith('insertText', false, 'de');
  });

  // A restored draft or a step navigation changes the value from outside; the
  // editor must pick it up rather than keep showing the previous content.
  it('reprend une valeur modifiée à l’extérieur', () => {
    const { rerender } = renderField({ value: 'Premier' });
    expect(editor().textContent).toBe('Premier');

    rerender(
      <RichTextField
        label="Présentation de la société"
        value="Second **texte**"
        onChange={vi.fn()}
        maxLength={5000}
      />,
    );

    expect(editor().textContent).toBe('Second texte');
    expect(screen.getByText('texte').tagName).toBe('STRONG');
  });

  // Paste and drop are the two routes by which a browser inserts foreign HTML
  // into a contentEditable. Both are reduced to plain text.
  it.each([
    ['collage', 'paste'],
    ['glisser-déposer', 'drop'],
  ])('réduit le %s à du texte brut', (_name, type) => {
    const onChange = vi.fn();
    renderField({ onChange });
    const target = editor();

    const transfer = {
      getData: (format: string) =>
        format === 'text/plain' ? '<img src=x onerror="alert(1)">' : '',
    };
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { clipboardData: transfer, dataTransfer: transfer });
    target.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith(
      'insertText',
      false,
      '<img src=x onerror="alert(1)">',
    );
    expect(target.querySelector('img')).toBeNull();
    expect(onChange.mock.lastCall?.[0]).not.toContain('<img');
  });

  it('affiche le balisage saisi comme du texte', () => {
    renderField({ value: '<script>alert(1)</script>' });

    expect(editor().querySelector('script')).toBeNull();
    expect(editor().textContent).toBe('<script>alert(1)</script>');
  });

  it('annonce le champ comme obligatoire quand on le demande', () => {
    renderField({ 'aria-required': true });

    expect(editor()).toHaveAttribute('aria-required', 'true');
  });

  it('cumule le compteur et le message d’erreur transmis', () => {
    renderField({ 'aria-describedby': 'wizard-error' });

    const described = editor().getAttribute('aria-describedby')?.split(' ') ?? [];

    expect(described).toContain('wizard-error');
    expect(described).toHaveLength(2);
  });

  it('affiche le nombre de caractères restants', () => {
    renderField({ value: 'abc', maxLength: 5000 });

    expect(screen.getByText('4 997 caractères restants')).toBeInTheDocument();
  });

  it('affiche un texte d’invite tant que rien n’est saisi', () => {
    renderField({ value: '', placeholder: 'Votre métier…' });

    expect(screen.getByText('Votre métier…')).toBeInTheDocument();
  });
});
