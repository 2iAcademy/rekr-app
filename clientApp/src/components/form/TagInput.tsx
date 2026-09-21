import { useId, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SKILL_CHIP } from '@/components/ui/chip-variants';
import { cn } from '@/lib/utils';
import { MAX_TAG_LABEL_LENGTH, MAX_TAGS } from '@/lib/bounds';

interface TagInputProps {
  label: string;
  placeholder?: string;
  values: string[];
  onChange: (values: string[]) => void;
  invalid?: boolean;
  describedBy?: string;
}

/**
 * Only the first letter: `Ticket restaurant 9€`, not `Ticket Restaurant 9€`.
 *
 * Labels end up in the shared `Tag` table, where `anglais` and `Anglais` would
 * become two separate entries. Normalising on the way in keeps that reference
 * table clean, and the chips consistent with each other.
 */
const capitalise = (label: string): string => label.charAt(0).toUpperCase() + label.slice(1);

/**
 * The placeholders advertise comma-separated input, and a comma inside a label
 * would be stored verbatim in the shared `Tag` table, so the separator is split
 * here rather than sent through.
 */
const parseTags = (draft: string): string[] =>
  draft
    .split(',')
    .map((fragment) => fragment.trim())
    .filter((fragment) => fragment !== '')
    .map(capitalise);

export function TagInput({
  label,
  placeholder,
  values,
  onChange,
  invalid,
  describedBy,
}: TagInputProps) {
  const fieldId = useId();
  const errorId = useId();
  const helpId = useId();
  const [draft, setDraft] = useState('');
  const [rejectedForCap, setRejectedForCap] = useState(false);

  // Derived rather than synchronised: removing a tag makes room again, and the
  // cap message must not linger once it does.
  const saturated = rejectedForCap && values.length >= MAX_TAGS;

  const commitDraft = (): void => {
    const parsed = parseTags(draft);
    if (parsed.length === 0) {
      setDraft('');
      return;
    }

    const added: string[] = [];
    let reachedCap = false;

    for (const tag of parsed) {
      const alreadyKnown = [...values, ...added].some(
        (known) => known.toLowerCase() === tag.toLowerCase(),
      );
      if (alreadyKnown) {
        continue;
      }

      if (values.length + added.length >= MAX_TAGS) {
        reachedCap = true;
        break;
      }

      added.push(tag);
    }

    setRejectedForCap(reachedCap);
    setDraft('');

    if (added.length > 0) {
      onChange([...values, ...added]);
    }
  };

  // Enter inside a wizard step would otherwise submit the whole form.
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitDraft();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <Input
        id={fieldId}
        value={draft}
        maxLength={MAX_TAG_LABEL_LENGTH}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        aria-invalid={saturated || invalid === true}
        aria-describedby={saturated ? errorId : (describedBy ?? helpId)}
      />

      {saturated ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          Maximum {MAX_TAGS} éléments.
        </p>
      ) : (
        <p id={helpId} className="text-xs text-ink-muted">
          Entrée pour valider, ou séparer par des virgules.
        </p>
      )}

      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2 pt-1">
          {values.map((value) => (
            <li
              key={value}
              className={cn(SKILL_CHIP, 'inline-flex items-center gap-1 py-1.5 pr-1.5')}
            >
              {value}
              <button
                type="button"
                aria-label={`Retirer ${value}`}
                onClick={() => onChange(values.filter((kept) => kept !== value))}
                // The hit area overflows the chip: the icon alone would be a
                // 24px target.
                className="relative flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors after:absolute after:-inset-2.5 hover:bg-line hover:text-ink focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
