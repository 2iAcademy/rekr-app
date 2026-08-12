import {
  useEffect,
  useId,
  useRef,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { Bold, Italic, List } from 'lucide-react';
import { htmlToMarkdown, markdownToHtml } from '@/lib/markdown';
import { cn } from '@/lib/utils';

/**
 * `execCommand` is deprecated but still implemented everywhere, and it is what
 * keeps this component small: the browser handles selection, caret and undo.
 * Only three commands are exposed, and the value is normalised back to Markdown
 * on every input, so whatever markup a browser emits never reaches the API.
 */
const COMMANDS = [
  { label: 'Gras', icon: Bold, command: 'bold' },
  { label: 'Italique', icon: Italic, command: 'italic' },
  { label: 'Liste à puces', icon: List, command: 'insertUnorderedList' },
] as const;

const placeCaretAtEnd = (target: HTMLElement): void => {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(target);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
};

interface RichTextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  placeholder?: string;
  'aria-required'?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

export function RichTextField({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  'aria-describedby': describedBy,
  ...aria
}: RichTextFieldProps) {
  const fieldId = useId();
  const hintId = useId();
  const editor = useRef<HTMLDivElement>(null);
  // What this component last emitted. Rewriting `innerHTML` on every keystroke
  // would reset the caret to the start, so the DOM is only re-synced when the
  // value changed somewhere else (a restored draft, a formatting command).
  const emitted = useRef<string | null>(null);

  useEffect(() => {
    if (editor.current && value !== emitted.current) {
      editor.current.innerHTML = markdownToHtml(value);
      emitted.current = value;
    }
  }, [value]);

  /**
   * Truncating only the emitted value would leave the editor showing text the
   * state has stopped recording — and since the truncated value equals the one
   * already emitted, neither React nor the effect above would ever put the DOM
   * back in line. So the overflow is cut where it is visible, too.
   */
  const publish = (): void => {
    if (!editor.current) {
      return;
    }

    const raw = htmlToMarkdown(editor.current.innerHTML);
    const markdown = raw.slice(0, maxLength);

    if (raw !== markdown) {
      editor.current.innerHTML = markdownToHtml(markdown);
      placeCaretAtEnd(editor.current);
    }

    emitted.current = markdown;
    onChange(markdown);
  };

  const run = (command: string): void => {
    editor.current?.focus();
    document.execCommand(command);
    publish();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

    const command = event.key === 'b' ? 'bold' : event.key === 'i' ? 'italic' : null;
    if (command) {
      event.preventDefault();
      run(command);
    }
  };

  // Pasting from a word processor would otherwise drop fonts, colours and
  // tracking pixels straight into the editable area.
  const handlePaste = (event: ClipboardEvent<HTMLDivElement>): void => {
    event.preventDefault();
    insertPlainText(event.clipboardData.getData('text/plain'));
  };

  // Dropping is a second, separate route into a contentEditable, and the
  // browser inserts the dragged HTML itself unless the event is cancelled.
  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    insertPlainText(event.dataTransfer.getData('text/plain'));
  };

  // Bounding the insertion keeps the common case free of a full re-render, and
  // stops a paste from being cut mid-marker by `publish`.
  function insertPlainText(text: string): void {
    editor.current?.focus();
    const room = maxLength - htmlToMarkdown(editor.current?.innerHTML ?? '').length;
    if (room <= 0) {
      return;
    }

    document.execCommand('insertText', false, text.slice(0, room));
    publish();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={fieldId} className="text-xs text-ink-muted">
        {label}
      </span>

      <div className="flex gap-1" role="toolbar" aria-label={`Mise en forme de « ${label} »`}>
        {COMMANDS.map(({ label: name, icon: Icon, command }) => (
          <button
            key={name}
            type="button"
            aria-label={name}
            title={name}
            // Keeps the selection: blurring the editor would collapse it before
            // the command runs.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run(command)}
            className="flex size-11 cursor-pointer items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-brand-tint hover:text-ink focus-visible:ring-3 focus-visible:ring-role/30 focus-visible:outline-none"
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>

      <div className="relative">
        {value === '' && placeholder && (
          <p
            aria-hidden="true"
            className="pointer-events-none absolute top-3 left-4 text-sm text-muted-foreground"
          >
            {placeholder}
          </p>
        )}

        <div
          ref={editor}
          role="textbox"
          contentEditable
          suppressContentEditableWarning
          aria-multiline="true"
          aria-labelledby={fieldId}
          aria-describedby={[hintId, describedBy].filter(Boolean).join(' ')}
          {...aria}
          onInput={publish}
          onBlur={publish}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onDrop={handleDrop}
          className={cn(
            'min-h-40 w-full overflow-auto rounded-xl border border-line bg-card px-4 py-3 text-sm text-ink outline-none transition-colors',
            'focus-visible:border-role focus-visible:ring-3 focus-visible:ring-role/20',
            'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
            '[&_ul]:list-disc [&_ul]:pl-5',
          )}
        />
      </div>

      <p id={hintId} className="text-right text-xs text-ink-faint">
        {(maxLength - value.length).toLocaleString('fr-FR')} caractères restants
      </p>
    </div>
  );
}
