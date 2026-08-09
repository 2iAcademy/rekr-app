import type { FormEvent, ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RoleTheme } from '@/lib/roleTheme';
import { WIZARD_ERROR_ID } from '../steps/stepProps';
import { WizardProgress } from './WizardProgress';

interface WizardShellProps {
  title: string;
  current: number;
  total: number;
  submitLabel: string;
  error?: string | null;
  submitting?: boolean;
  onBack: () => void;
  onSubmit: () => void;
  children: ReactNode;
}

export function WizardShell({
  title,
  current,
  total,
  submitLabel,
  error = null,
  submitting = false,
  onBack,
  onSubmit,
  children,
}: WizardShellProps) {
  const canGoBack = current > 1;

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <main
      data-role={'recruiter' satisfies RoleTheme}
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-6 pt-4 pb-8 md:max-w-3xl md:px-21 lg:max-w-none lg:items-center lg:justify-center lg:px-6 lg:py-10"
    >
      {/* Desktop lifts the form into a centred card; mobile and tablet keep the
          full-height flow with the action bar pinned to the bottom. */}
      <div className="flex w-full flex-1 flex-col lg:max-w-[32.5rem] lg:flex-none lg:rounded-3xl lg:bg-card lg:p-10 lg:shadow-lg">
        <header className="relative flex h-9 items-center justify-center lg:justify-start">
          {canGoBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Retour"
              className="absolute left-0 flex size-9 cursor-pointer items-center justify-center rounded-full bg-card text-ink shadow-sm transition-colors hover:bg-muted lg:hidden"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
          <h1 className="font-heading text-base font-bold text-ink md:text-lg">{title}</h1>
        </header>

        <div className="mt-6">
          <WizardProgress current={current} total={total} />
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-1 flex-col">
          <div className="flex flex-col gap-5">{children}</div>

          {error && (
            <p id={WIZARD_ERROR_ID} role="alert" className="mt-5 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="mt-auto flex gap-3 pt-8 lg:mt-8 lg:pt-0">
            {canGoBack && (
              <Button
                type="button"
                variant="soft"
                size="xl"
                onClick={onBack}
                disabled={submitting}
                className="flex-1"
              >
                Retour
              </Button>
            )}
            <Button type="submit" variant="role" size="xl" disabled={submitting} className="flex-1">
              {submitting ? 'Publication…' : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
