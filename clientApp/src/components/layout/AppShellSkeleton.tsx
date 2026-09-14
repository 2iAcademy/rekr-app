/**
 * The shell's geometry, held while the boot refresh settles the session.
 *
 * Deliberately not `AppSidebar` and `AppHeader`: both need a user, and letting
 * them render without one is exactly what showed a recruiter the candidate
 * identity for the whole round-trip. This carries no identity, and no
 * `data-role` either, so it also stays clear of `--line` and the `--role-*`
 * custom properties — the only ones the palette actually switches. Its blocks
 * are separated by `bg-card` against `bg-background` rather than by a border,
 * since `border-line` is role-scoped.
 */
export function AppShellSkeleton() {
  return (
    <div className="flex min-h-dvh w-full overflow-x-clip bg-background">
      <p role="status" className="sr-only">
        Chargement de votre session
      </p>

      {/* Same width as the real sidebar, and gated on the same breakpoint, so
          the content does not shift sideways when the chrome takes over. */}
      <div aria-hidden="true" className="hidden w-56 shrink-0 bg-card desktop:block" />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Height of the real header: a 44px touch target plus its `py-2`. */}
        <div aria-hidden="true" className="min-h-15 w-full shrink-0 bg-card desktop:hidden" />
      </div>
    </div>
  );
}
