import { createContext, useContext, useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionsState {
  isOpen: (value: string) => boolean;
  toggle: (value: string) => void;
}

const SectionsContext = createContext<SectionsState | null>(null);

interface ProfileSectionsProps {
  /**
   * Sections open on arrival, named explicitly. Inferring « the first one »
   * from the children meant reading them during render to register it, which is
   * a state write in a render pass — the caller already knows which section
   * matters, and saying so is one line.
   */
  defaultOpen: readonly string[];
  children: ReactNode;
}

/**
 * The collapsible frame the two profile screens are built on.
 *
 * Both were a single linear form — nineteen blocks on the candidate side — that
 * had to be scrolled through in full to reach the save button. Grouping them
 * lets a reader open the part they came for and leave the rest folded.
 *
 * Hand-rolled rather than built on Base UI's `Accordion`, and the reason is
 * measurement: that component freezes an explicit panel height for its
 * animation, and its item clips to it. These panels mount before the profile
 * has loaded, so the height was captured on an empty form — the city field's
 * suggestion list was then cut off at the card's edge. A plain conditional
 * mount has no height to get wrong.
 *
 * Several sections stay open at once: auto-folding the one just filled in would
 * hide an entry still being typed. Unmounting a folded panel costs nothing here
 * — every field is controlled and its value lives in the parent's state.
 */
export function ProfileSections({ defaultOpen, children }: ProfileSectionsProps) {
  const [open, setOpen] = useState<readonly string[]>(defaultOpen);

  const state: SectionsState = {
    isOpen: (value) => open.includes(value),
    toggle: (value) =>
      setOpen((current) =>
        current.includes(value)
          ? current.filter((entry) => entry !== value)
          : [...current, value],
      ),
  };

  return (
    <SectionsContext.Provider value={state}>
      <div className="mt-6 flex flex-col gap-3">{children}</div>
    </SectionsContext.Provider>
  );
}

interface ProfileSectionProps {
  /** Stable identifier, used by `defaultOpen`. */
  value: string;
  title: string;
  /**
   * What the section holds, in a few words, shown while it is folded.
   *
   * This is what makes folding worth anything: a header that only says « Mes
   * préférences » forces the reader to open every section to find the one they
   * came for, and tells them nothing about what is already filled in. Left
   * empty, the section reads as untouched and says so.
   */
  summary?: string;
  children: ReactNode;
}

export function ProfileSection({ value, title, summary, children }: ProfileSectionProps) {
  const sections = useContext(SectionsContext);
  const panelId = useId();

  if (sections === null) {
    throw new Error('ProfileSection must be used inside ProfileSections');
  }

  const isOpen = sections.isOpen(value);

  return (
    <section className="rounded-2xl border border-line bg-card">
      <h2 className="m-0">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => sections.toggle(value)}
          className={cn(
            'flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left',
            'font-heading text-base font-semibold text-ink transition-colors hover:bg-brand-tint/40',
            'outline-none focus-visible:ring-3 focus-visible:ring-role/40',
          )}
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            {title}
            {!isOpen && (
              <span className="truncate text-xs font-normal text-ink-muted">
                {summary === undefined || summary === '' ? 'À compléter' : summary}
              </span>
            )}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-5 shrink-0 text-ink-muted transition-transform duration-200',
              isOpen && 'rotate-180',
            )}
          />
        </button>
      </h2>

      {isOpen && (
        <div id={panelId} className="flex flex-col gap-5 border-t border-line px-5 py-5">
          {children}
        </div>
      )}
    </section>
  );
}
