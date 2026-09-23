import { useId, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';

interface TextFieldProps extends Omit<ComponentProps<'input'>, 'id'> {
  label: string;
  /** A line under the input, read by screen readers as its description. */
  hint?: string;
}

export function TextField({ label, hint, ...props }: TextFieldProps) {
  const id = useId();
  const hintId = useId();
  const describedBy =
    [props['aria-describedby'], hint ? hintId : undefined].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs text-ink-muted">
        {label}
      </label>
      <Input id={id} {...props} aria-describedby={describedBy} />
      {hint && (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
