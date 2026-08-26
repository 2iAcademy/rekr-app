interface ProfilePageProps {
  email: string;
  // Display label ('Candidat' / 'Recruteur'), not the session `role` field,
  // which carries the permission level ('user' / 'admin').
  roleLabel: string;
}

/** Placeholder screen: the real profile lands with #67 (candidat) and #68 (recruteur). */
export function ProfilePage({ email, roleLabel }: ProfilePageProps) {
  return (
    <div className="mx-auto max-w-3xl md:mx-0 lg:max-w-4xl xl:max-w-5xl">
      <h1 className="mt-5 font-heading text-xl font-bold text-ink md:mt-0 md:text-2xl">Profil</h1>

      <dl className="mt-6 flex flex-col gap-4 rounded-2xl border border-line bg-card p-5">
        <div className="flex flex-col gap-0.5">
          <dt className="text-[0.65rem] font-semibold tracking-wide text-ink-muted uppercase">
            Email
          </dt>
          <dd className="text-sm break-all text-ink">{email}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-[0.65rem] font-semibold tracking-wide text-ink-muted uppercase">
            Rôle
          </dt>
          <dd className="text-sm text-ink">{roleLabel}</dd>
        </div>
      </dl>

      <p className="mt-6 text-sm leading-relaxed text-ink-muted">
        Le reste de ton profil arrive bientôt.
      </p>
    </div>
  );
}
