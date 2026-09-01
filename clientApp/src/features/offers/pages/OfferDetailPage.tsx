import { Heart, X } from 'lucide-react';
import { AvatarBanner } from '@/components/ui/avatar-banner';
import { Button } from '@/components/ui/button';
import { chipVariants } from '@/components/ui/chip-variants';
import { SectionTitle } from '@/components/ui/section-title';
import { useEffect, useState } from 'react';
import { offerControllerFindOneById } from '@/api/generated';
import type { OfferDetailDto, TagCategory } from '@/api/generated';
import { fileUrl } from '@/lib/fileUrl';
import { useParams } from 'react-router';

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
  const [offer, setOffer] = useState<OfferDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOffer = async () => {
      try {
        const res = await offerControllerFindOneById(Number(id));
        setOffer(res.data);
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

  const { company, tags, salaryMin, salaryMax, remotePolicy, city } = offer;
  const companyLogoUrl = fileUrl(company.logo);
  const labelsOf = (...categories: TagCategory[]) =>
    tags.filter((tag) => categories.includes(tag.category)).map((tag) => tag.label);
  const stack = labelsOf('skill', 'tech');
  const benefits = labelsOf('benefit');
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

      <AvatarBanner size="lg" name={company.name} imageUrl={companyLogoUrl} />

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
          <SectionTitle>Stack technique</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {stack.map((tech) => (
              <span key={tech} className={chipVariants({ size: 'sm' })}>
                {tech}
              </span>
            ))}
            {remotePolicy && (
              <span className={chipVariants({ size: 'sm' })}>
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
          <SectionTitle>Salaire</SectionTitle>
          <p className="text-base font-bold text-ink">{salary}</p>
        </div>

        {benefits.length > 0 && (
          <div className="mt-6 flex flex-col gap-3">
            <SectionTitle>Avantages</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {benefits.map((benefit) => (
                <span key={benefit} className={chipVariants({ size: 'sm' })}>
                  {benefit}
                </span>
              ))}
            </div>
          </div>
        )}

        {offer.description && (
          <div className="mt-6 flex flex-col gap-2">
            <SectionTitle>À propos du poste</SectionTitle>
            <p className="text-sm leading-relaxed text-ink-muted">{offer.description}</p>
          </div>
        )}

        {company.description && (
          <div className="mt-6 flex flex-col gap-2">
            <SectionTitle>À propos de l'entreprise</SectionTitle>
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
