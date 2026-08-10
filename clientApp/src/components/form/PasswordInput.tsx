import { useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PasswordInputProps extends Omit<ComponentProps<'input'>, 'type'> {
  subject?: string;
}

export function PasswordInput({
  className,
  subject = 'le mot de passe',
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-12', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((shown) => !shown)}
        aria-label={`${visible ? 'Masquer' : 'Afficher'} ${subject}`}
        className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center rounded-r-xl text-ink-muted transition-colors hover:text-ink focus-visible:ring-3 focus-visible:ring-role/20 focus-visible:outline-none"
      >
        <Icon className="size-5" />
      </button>
    </div>
  );
}
