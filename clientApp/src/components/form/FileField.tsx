import { useId, useRef, useState, type ChangeEvent } from 'react';
import { Paperclip, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  acceptAttribute,
  constraintHint,
  validateFile,
  type FileConstraint,
} from './fileConstraints';

interface FileFieldProps {
  label: string;
  /** Extension and size rules, taken from `FILE_CONSTRAINTS`. */
  constraint: FileConstraint;
  /**
   * Read URL of the stored file, when it can be displayed. `null` for an empty
   * slot, and for a file the API does not serve publicly — a CV.
   */
  previewUrl?: string | null;
  /**
   * Whether a file is stored. Defaults to « there is a preview », which is what
   * an image slot means; a CV has to say so itself.
   */
  hasFile?: boolean;
  presentLabel?: string;
  emptyLabel?: string;
  /** Called only with a file that passed the extension and size checks. */
  onSelect: (file: File) => void;
  /** Omitted when the slot cannot be emptied: no control is rendered at all. */
  onRemove?: () => void;
  busy?: boolean;
  busyLabel?: string;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

/**
 * A presentational file slot: it validates, then hands the file over. Nothing
 * here uploads, so the same component serves the picture, the CV, the logo and
 * the cover image, and the screen owns the request and its feedback.
 */
export function FileField({
  label,
  constraint,
  previewUrl,
  hasFile,
  presentLabel = 'Fichier enregistré',
  emptyLabel = 'Aucun fichier',
  onSelect,
  onRemove,
  busy = false,
  busyLabel = 'Envoi en cours…',
  required,
  invalid,
  describedBy,
}: FileFieldProps) {
  const fieldId = useId();
  const hintId = useId();
  const errorId = useId();
  const [rejection, setRejection] = useState<string | null>(null);

  // An empty string is a valid `string | null` and the API is free to send one.
  const preview = previewUrl?.trim() || null;
  const filled = hasFile ?? preview !== null;

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];

    // The field is a trigger, not a form value: the parent uploads at once and
    // then owns the displayed state. Clearing it also lets the very same file be
    // picked again after a rejection, which a retained value would swallow.
    event.target.value = '';

    if (!file) {
      return;
    }

    const reason = validateFile(file, constraint);
    setRejection(reason);

    if (reason === null) {
      onSelect(file);
    }
  };

  // The native input is kept in the DOM and labelled, but taken out of the
  // layout: the « Aucun fichier choisi » text the browser appends next to it
  // cannot be styled, and it repeated the state line just above. A real button
  // opens the picker instead, in the same visual language as the rest of the
  // form.
  const inputRef = useRef<HTMLInputElement>(null);

  const described = [hintId, rejection === null ? null : errorId, describedBy]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-xs text-ink-muted">
        {label}
      </label>

      <div className="flex items-center gap-3">
        {preview === null ? (
          <span
            aria-hidden="true"
            className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-line bg-card text-ink-faint"
          >
            <Paperclip className="size-5" />
          </span>
        ) : (
          <img
            src={preview}
            alt={label}
            className="size-16 shrink-0 rounded-xl border border-line object-cover"
          />
        )}

        <p className="min-w-0 flex-1 truncate text-sm text-ink-soft">
          {filled ? presentLabel : emptyLabel}
        </p>

        {filled && onRemove !== undefined && (
          <Button
            // Explicit, because this field can sit inside a form: a `button`
            // with no type submits it, so removing a photo would have saved the
            // whole profile.
            type="button"
            variant="destructive"
            size="sm"
            aria-label={`Supprimer ${label}`}
            disabled={busy}
            onClick={onRemove}
          >
            <Trash2 />
            Supprimer
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        id={fieldId}
        type="file"
        accept={acceptAttribute(constraint)}
        disabled={busy}
        aria-required={required}
        aria-invalid={rejection !== null || invalid === true}
        aria-describedby={described}
        onChange={handleChange}
        className="sr-only"
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {filled ? 'Remplacer' : 'Choisir un fichier'}
        </Button>

        <p id={hintId} className="text-xs text-ink-faint">
          {constraintHint(constraint)}
        </p>
      </div>

      {rejection !== null && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {rejection}
        </p>
      )}

      {busy && (
        <p role="status" className="text-xs text-role">
          {busyLabel}
        </p>
      )}
    </div>
  );
}
