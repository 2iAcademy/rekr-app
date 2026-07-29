import { Heart, Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mockOffer, type Offer } from '@/features/offers/data/mock-offer';

interface OfferDetailPageProps {
  onBack?: () => void;
  onPass?: () => void;
  onLike?: () => void;
  offer?: Offer;
}

export function OfferDetailPage({
  onBack,
  onPass,
  onLike,
  offer = mockOffer,
}: OfferDetailPageProps) {
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
        <button
          type="button"
          aria-label="Agrandir"
          className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-card text-ink shadow-sm transition-colors hover:bg-muted"
        >
          <Maximize2 className="size-5" />
        </button>
      </header>

      <section className="relative flex h-52 items-center justify-center bg-role-gradient pt-12">
        <div className="flex size-24 items-center justify-center rounded-full bg-white shadow-md">
          <span className="font-heading text-3xl font-bold text-brand">{offer.company[0]}</span>
        </div>
      </section>

      <section className="relative -mt-4 flex flex-1 flex-col rounded-t-3xl bg-background px-6 pt-6 pb-32">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-2xl font-bold text-ink">{offer.title}</h2>
          <p className="text-sm text-ink-muted">
            {offer.company} · {offer.companySize} · {offer.location}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <h3 className="text-xs font-semibold tracking-wider text-ink-muted uppercase">
            Stack technique
          </h3>
          <div className="flex flex-wrap gap-2">
            {offer.stack.map((tech) => (
              <span
                key={tech}
                className="rounded-full bg-brand-tint px-3 py-1 text-xs font-medium text-brand-strong"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-1">
          <h3 className="text-xs font-semibold tracking-wider text-ink-muted uppercase">Salaire</h3>
          <p className="text-base font-bold text-ink">{offer.salary}</p>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wider text-ink-muted uppercase">
            À propos du poste
          </h3>
          <p className="text-sm leading-relaxed text-ink-muted">{offer.aboutRole}</p>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wider text-ink-muted uppercase">
            À propos de l'entreprise
          </h3>
          <p className="text-sm leading-relaxed text-ink-muted">{offer.aboutCompany}</p>
        </div>
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
          onClick={onLike}
        >
          <Heart className="size-5" />
          Liker
        </Button>
      </div>
    </main>
  );
}
