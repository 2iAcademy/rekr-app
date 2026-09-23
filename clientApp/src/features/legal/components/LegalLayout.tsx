import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';

interface LegalLayoutProps {
  title: string;
  /** The version line, shown under the title: what a consent was given to. */
  version: string;
  onBack?: () => void;
  children: ReactNode;
}

/**
 * The frame shared by the two legal texts. Full-frame and outside the shell:
 * both are read before an account exists, from a link on the sign-up form.
 */
export function LegalLayout({ title, version, onBack, children }: LegalLayoutProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col bg-background px-6 pt-4 pb-12">
      <header className="relative flex h-9 items-center justify-center">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Retour"
            className="absolute left-0 flex size-9 cursor-pointer items-center justify-center rounded-full bg-card text-ink shadow-sm transition-colors hover:bg-muted"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}
      </header>

      <h1 className="mt-6 font-heading text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-1 text-xs text-ink-muted">{version}</p>

      <div className="mt-6 flex flex-col gap-6 text-sm leading-relaxed text-ink [&_h2]:font-heading [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        {children}
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
