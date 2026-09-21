import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuthLayoutProps {
  title: string;
  onBack?: () => void;
  /** The link to the neighbouring screen (sign in ↔ sign up), under the card. */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * The frame shared by the account screens: a top bar with the way back and the
 * screen name, then one card holding the form, centred and capped in width so
 * a tablet or desktop does not stretch the fields.
 */
export function AuthLayout({ title, onBack, footer, children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-dvh w-full flex-col bg-background">
      <header className="border-b border-line bg-card">
        <div className="relative mx-auto flex h-14 w-full max-w-md items-center justify-center px-4">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            onClick={onBack}
            aria-label="Retour"
            className="absolute left-2 size-11 rounded-xl text-ink"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-base font-bold text-ink">{title}</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-10 md:pt-12">
        <div className="rounded-2xl border border-line bg-card p-5 shadow-card sm:p-8">
          {children}
        </div>

        {footer && (
          <p className="mt-6 flex flex-wrap items-center justify-center gap-x-1.5 text-sm text-ink-muted">
            {footer}
          </p>
        )}
      </div>
    </main>
  );
}
