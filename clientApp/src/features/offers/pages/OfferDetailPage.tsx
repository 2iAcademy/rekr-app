import { Heart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { offerControllerFindOneById } from '@/api/generated';
import { fileUrl } from '@/lib/fileUrl';
import { useParams } from 'react-router';

interface OfferCompany {
  id: number;
  name: string;
  logo: string | null;
  size: string | null;
  description: string | null;
  city: string | null;
}

interface OfferTag {
  tag: {
    id: number;
    label: string;
    category: string;
  };
}

interface OfferDetail {
  id: number;
  title: string;
  description: string | null;
  city: string | null;
  contractType: string | null;
  minExperienceLevel: string | null;
  remotePolicy: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  status: string;
  company: OfferCompany;
  offerTags: OfferTag[];
}

interface MatchedProfile {
  name: string;
  avatarUrl: string | null;
}

interface OfferDetailPageProps {
  onBack?: () => void;
  onPass?: () => void;
  onLike?: (matchedProfile: MatchedProfile) => void;
}

export function OfferDetailPage({ onBack, onPass, onLike }: OfferDetailPageProps) {
  const { id } = useParams();
  const [offer, setOffer] = useState<OfferDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOffer = async () => {
      try {
        const res = await offerControllerFindOneById(Number(id));
        setOffer(res.data as unknown as OfferDetail);
      } catch (err) {
        console.error(err);
        setError('Offre introuvable.');
      } finally {
        setIsLoading(false);
      }
    };
    if (id) {
      fetchOffer();
    }
  }, [id]);

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center justify-center bg-background">
        <p className="text-sm text-ink-muted">Chargement…</p>
      </main>
    );
  }

  if (error || !offer) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-4 bg-background">
        <p className="text-sm text-ink-muted">{error ?? 'Offre introuvable.'}</p>
      </main>
    );
  }

  const { company, offerTags, salaryMin, salaryMax, remotePolicy, city } = offer;
  const companyLogoUrl = fileUrl(company.logo);
  const stack = offerTags
    .filter((ot) => ot.tag.category === 'skill' || ot.tag.category === 'tech')
    .map((ot) => ot.tag.label);
  const toK = (value: number | null) => (value != null ? Math.round(value / 1000) : '?');
  const salary =
    salaryMin != null || salaryMax != null
      ? `${toK(salaryMin)} - ${toK(salaryMax)} k€`
      : 'Non communiqué';

  return (
    <main
      data-role="candidat"
      className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-background"
    >
      <header className="absolute top-0 left-0 right-0 z-10 flex h-12 items-center justify-between px-4 pt-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Fermer"
          className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-card text-ink shadow-sm transition-colors hover:bg-muted"
        >
          <X className="size-5" />
        </button>
        <h1 className="font-heading text-base font-bold text-ink">Détail</h1>
        <div className="size-9" aria-hidden="true" />
      </header>

      <section className="relative flex h-52 items-center justify-center bg-role-gradient pt-12">
        <div className="flex size-24 items-center justify-center rounded-full bg-white shadow-md">
          {companyLogoUrl ? (
            <img
              src={companyLogoUrl}
              alt={company.name}
              className="size-full rounded-full object-cover"
            />
          ) : (
            <span className="font-heading text-3xl font-bold text-brand">{company.name[0]}</span>
          )}
        </div>
      </section>

      <section className="relative -mt-4 flex flex-1 flex-col rounded-t-3xl bg-background px-6 pt-6 pb-32">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-2xl font-bold text-ink">{offer.title}</h2>
          <p className="text-sm text-ink-muted">
            {company.name}
            {company.size ? ` · ${company.size}` : ''}
            {city ? ` · ${city}` : ''}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <h3 className="text-xs font-semibold tracking-wider text-ink-muted uppercase">
            Stack technique
          </h3>
          <div className="flex flex-wrap gap-2">
            {stack.map((tech) => (
              <span
                key={tech}
                className="rounded-full bg-brand-tint px-3 py-1 text-xs font-medium text-brand-strong"
              >
                {tech}
              </span>
            ))}
            {remotePolicy && (
              <span className="rounded-full bg-brand-tint px-3 py-1 text-xs font-medium text-brand-strong">
                {remotePolicy === 'FULL_REMOTE'
                  ? 'Remote'
                  : remotePolicy === 'HYBRID'
                    ? 'Hybride'
                    : 'Présentiel'}
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-1">
          <h3 className="text-xs font-semibold tracking-wider text-ink-muted uppercase">Salaire</h3>
          <p className="text-base font-bold text-ink">{salary}</p>
        </div>

        {offer.description && (
          <div className="mt-6 flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wider text-ink-muted uppercase">
              À propos du poste
            </h3>
            <p className="text-sm leading-relaxed text-ink-muted">{offer.description}</p>
          </div>
        )}

        {company.description && (
          <div className="mt-6 flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wider text-ink-muted uppercase">
              À propos de l'entreprise
            </h3>
            <p className="text-sm leading-relaxed text-ink-muted">{company.description}</p>
          </div>
        )}
      </section>

      <div className="sticky bottom-0 flex gap-3 bg-background/80 px-6 py-4 backdrop-blur-md">
        <Button
          type="button"
          variant="outline"
          size="xl"
          className="flex-1 rounded-full"
          onClick={onPass}
        >
          Passer
        </Button>
        <Button
          type="button"
          variant="role"
          size="xl"
          className="flex-1 rounded-full"
          onClick={() => onLike?.({ name: company.name, avatarUrl: companyLogoUrl })}
        >
          <Heart className="size-5" />
          Liker
        </Button>
      </div>
    </main>
  );
}
