import { useId, useRef, useState, type ChangeEvent } from 'react';
import { FileText, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  acceptAttribute,
  constraintHint,
  validateFile,
  type FileConstraint,
} from './fileConstraints';

// Text actions under the file name: two outlined buttons next to a thumbnail
// left no room for the name itself on a phone.
const FILE_ACTION =
  '-my-1 inline-flex min-h-11 cursor-pointer items-center rounded-md text-sm font-semibold text-brand-strong underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

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

  const openPicker = (): void => inputRef.current?.click();

  const hint = (
    <p id={hintId} className="text-xs text-ink-muted">
      {constraintHint(constraint)}
    </p>
  );

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-sm font-semibold text-ink">
        {label}
      </label>

      {filled ? (
        <>
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3">
            {preview === null ? (
              <span
                aria-hidden="true"
                className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-surface text-ink-soft"
              >
                <FileText className="size-5" />
              </span>
            ) : (
              <img
                src={preview}
                alt={label}
                className="size-14 shrink-0 rounded-xl border border-line object-cover"
              />
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{presentLabel}</p>
              <div className="flex gap-4">
                <button type="button" disabled={busy} onClick={openPicker} className={FILE_ACTION}>
                  Remplacer
                </button>

                {onRemove !== undefined && (
                  <button
                    // Explicit, because this field can sit inside a form: a
                    // `button` with no type submits it, so removing a photo
                    // would have saved the whole profile.
                    type="button"
                    aria-label={`Supprimer ${label}`}
                    disabled={busy}
                    onClick={onRemove}
                    className={cn(FILE_ACTION, 'text-destructive')}
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          </div>
          {hint}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-input bg-card px-4 py-6 text-center">
          <span
            aria-hidden="true"
            className="flex size-11 items-center justify-center rounded-full bg-surface text-ink-soft"
          >
            <Upload className="size-5" />
          </span>
          <p className="text-sm font-semibold text-ink">{emptyLabel}</p>
          {hint}
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={openPicker}
            className="mt-1 h-11 rounded-xl px-4"
          >
            Choisir un fichier
          </Button>
        </div>
      )}

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

      {rejection !== null && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {rejection}
        </p>
      )}

      {busy && (
        <p role="status" className="text-xs text-ink-muted">
          {busyLabel}
        </p>
      )}
    </div>
  );
}
