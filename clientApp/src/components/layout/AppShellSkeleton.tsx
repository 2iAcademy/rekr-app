/**
 * The shell's geometry, held while the boot refresh settles the session.
 *
 * Deliberately not `AppSidebar` and `AppHeader`: both need a user, and letting
 * them render without one is exactly what showed a recruiter the candidate
 * identity for the whole round-trip. This carries no identity at all: its
 * blocks are only `bg-card` against `bg-background`.
 */
export function AppShellSkeleton() {
  return (
    <div className="flex min-h-dvh w-full overflow-x-clip bg-background">
      <p role="status" className="sr-only">
        Chargement de votre session
      </p>

      {/* Same width as the real sidebar, and gated on the same breakpoint, so
          the content does not shift sideways when the chrome takes over. */}
      <div aria-hidden="true" className="hidden w-60 shrink-0 bg-card desktop:block" />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Height of the real header. */}
        <div aria-hidden="true" className="h-15 w-full shrink-0 bg-card desktop:hidden" />
      </div>
    </div>
  );
}
