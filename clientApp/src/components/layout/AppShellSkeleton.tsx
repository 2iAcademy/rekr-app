/**
 * The shell's geometry, held while the boot refresh settles the session.
 *
 * Deliberately not `AppHeader`: it needs a user, and letting it render without
 * one is exactly what showed a recruiter the candidate identity for the whole
 * round-trip. This carries no identity at all: its block is only `bg-card`
 * against `bg-background`.
 */
export function AppShellSkeleton() {
  return (
    <div className="flex min-h-dvh w-full flex-col overflow-x-clip bg-background">
      <p role="status" className="sr-only">
        Chargement de votre session
      </p>

      {/* Height of the real header, at every width: the header is the only
          chrome above the content, so the page does not jump when it lands. */}
      <div aria-hidden="true" className="h-15 w-full shrink-0 border-b border-line bg-card" />
    </div>
  );
}
