import type { FormEvent, ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WIZARD_ERROR_ID } from './wizardError';
import { WizardProgress } from './WizardProgress';

interface WizardShellProps {
  title: string;
  current: number;
  total: number;
  submitLabel: string;
  submittingLabel: string;
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
  submittingLabel,
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
    <main className="flex min-h-dvh w-full flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-line bg-card">
        <div className="mx-auto flex min-h-16 w-full max-w-xl items-center gap-3 px-4 py-2">
          {canGoBack && (
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              onClick={onBack}
              aria-label="Retour"
              className="-ml-2 size-11 rounded-xl text-ink"
            >
              <ArrowLeft className="size-5" />
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <WizardProgress current={current} total={total} />
          </div>
        </div>
      </header>

      {/* The action bar sits in the form's flow and sticks to the viewport: a
          short step keeps it at the bottom of the screen, a long one scrolls
          under it. The wizard runs before the app shell exists, hence a plain
          `bottom-0`. */}
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-xl flex-1 px-4 pt-6 pb-8 md:pt-10">
          <h1 className="text-2xl font-extrabold text-ink md:text-[1.75rem]">{title}</h1>

          <div className="mt-5 flex flex-col gap-5 rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6">
            {children}
          </div>

          {error && (
            <p
              id={WIZARD_ERROR_ID}
              role="alert"
              className="mt-4 rounded-xl bg-destructive-tint px-4 py-3 text-sm font-medium text-destructive"
            >
              {error}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-line bg-card">
          <div className="mx-auto flex w-full max-w-xl gap-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {canGoBack && (
              <Button
                type="button"
                variant="outline"
                size="xl"
                onClick={onBack}
                disabled={submitting}
              >
                Retour
              </Button>
            )}
            <Button
              type="submit"
              variant="brand"
              size="xl"
              disabled={submitting}
              className="flex-1"
            >
              {submitting ? submittingLabel : submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </main>
  );
}
