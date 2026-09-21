import type { ReactNode } from 'react';

interface AccountPageProps {
  email: string;
  // Display label ('Candidat' / 'Recruteur'), not the session `role` field,
  // which carries the permission level ('user' / 'admin').
  roleLabel: string;
  // The role-specific half of the screen. Passing it in keeps this page
  // presentational: it never has to know which sections exist.
  children?: ReactNode;
}

/**
 * The account screen.
 *
 * The header is the identity it edits — who is signed in and as what — rather
 * than a card of its own: a card pushed the first editable field a full screen
 * down on a phone. The role-specific sections that follow carry the headings.
 *
 * `max-w-2xl` and not the shell's own width: this is a form, and a text input
 * stretched over 900px is neither readable nor pleasant to fill. No bottom
 * padding of its own: the sticky save bar sits in the flow, and the shell's
 * `main` already clears the phone tab bar.
 */
export function AccountPage({ email, roleLabel, children }: AccountPageProps) {
  return (
    <div className="mx-auto max-w-2xl md:mx-0">
      <header className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-tint text-xl font-extrabold text-brand-strong"
        >
          {email.trim().charAt(0).toUpperCase()}
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-extrabold text-ink md:text-[1.75rem]">Mon compte</h1>
            <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
              {roleLabel}
            </span>
          </div>
          <p className="mt-0.5 text-sm break-all text-ink-muted">{email}</p>
        </div>
      </header>

      {children}
    </div>
  );
}
