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
 * The identity sits on one line instead of in a card of its own: the email and
 * the role are the two things on this page nobody came to read, and the card
 * they used to fill pushed the first editable field a full screen down on a
 * phone. The role-specific sections that follow carry the single heading — a
 * second « Mon profil » under « Mon compte » named the same thing twice.
 *
 * `max-w-2xl` and not the shell's own width: this is a form, and a text input
 * stretched over 900px is neither readable nor pleasant to fill. `pb-28` is the
 * room the sticky save bar needs — without it the bar covers the last field
 * instead of floating over the gap.
 */
export function AccountPage({ email, roleLabel, children }: AccountPageProps) {
  return (
    <div className="mx-auto max-w-2xl pb-28 md:mx-0">
      <header className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 md:mt-0">
        <h1 className="font-heading text-xl font-bold text-ink md:text-2xl">Mon compte</h1>
        <span className="rounded-full bg-role/10 px-2.5 py-0.5 text-xs font-semibold text-role">
          {roleLabel}
        </span>
      </header>

      <p className="mt-1 text-sm break-all text-ink-muted">{email}</p>

      {children}
    </div>
  );
}
