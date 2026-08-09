import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'w-full resize-none rounded-xl border border-line bg-card px-4 py-3 text-sm text-ink outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-role focus-visible:ring-3 focus-visible:ring-role/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
