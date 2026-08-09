import { useId, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';

interface TextFieldProps extends Omit<ComponentProps<'input'>, 'id'> {
  label: string;
}

export function TextField({ label, ...props }: TextFieldProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs text-ink-muted">
        {label}
      </label>
      <Input id={id} {...props} />
    </div>
  );
}
