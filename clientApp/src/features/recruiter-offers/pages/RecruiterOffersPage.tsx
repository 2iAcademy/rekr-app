import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Briefcase, ListFilter, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { OFFER_STATUS_OPTIONS, type OfferStatus } from '@/domain/offerStatus';
import type { BusinessMessages } from '@/lib/feedback/failureMessage';
import { notifyFailure, notifySuccess } from '@/lib/feedback/notify';
import { cn } from '@/lib/utils';
import { OfferRow } from '../components/OfferRow';
import { OFFERS_PAGE_SIZE, useOffers, type OfferStatusFilter } from '../useOffers';

const NEW_OFFER_PATH = '/recruteur/offres/nouvelle';

const STATUS_UPDATE_SUCCESS = 'Statut de l’offre mis à jour.';

// 401 and 403 are the session's business, not this screen's: the shared
// technical wording covers them. 404 is the one case worth wording, because it
// tells the recruiter their list is stale rather than that something broke.
const statusUpdateBusiness: BusinessMessages = {
  404: 'Cette offre n’existe plus.',
};

const FILTERS: readonly { value: OfferStatusFilter; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  ...OFFER_STATUS_OPTIONS,
];

const PRIMARY_ACTION = cn(buttonVariants({ variant: 'brand' }), 'h-11 rounded-xl px-5');

function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-card px-6 py-10 text-center shadow-card">
      <span className="flex size-14 items-center justify-center rounded-full bg-brand-tint text-brand [&_svg]:size-6">
        {icon}
      </span>
      <h2 className="mt-1 text-lg font-bold text-ink">{title}</h2>
      <p className="max-w-sm text-sm text-ink-muted">{text}</p>
      <div className="mt-2">{action}</div>
    </div>
  );
}

/**
 * The recruiter's offers, all statuses confounded, with the status of each one
 * changeable in place.
 *
 * Rendered inside `AppShell`, which owns the `main` landmark and the page
 * padding; the URL, the role guard and the create/edit screens belong to the
 * routes. The page takes no props: everything it shows comes from `useOffers`,
 * and the tests drive it through the mocked client rather than through an
 * injected list.
 *
 * Layout: one column on mobile, the header splitting into a title and a call to
 * action from `md:` up, and a wider measure past `desktop:` so the rows do not
 * stretch into an unreadable line on a 1440 screen.
 */
export function RecruiterOffersPage() {
  const {
    offers,
    status,
    truncated,
    statusFilter,
    setStatusFilter,
    pendingId,
    reload,
    updateStatus,
  } = useOffers();

  const changeStatus = async (id: number, next: OfferStatus): Promise<void> => {
    try {
      await updateStatus(id, next);
      notifySuccess(STATUS_UPDATE_SUCCESS);
    } catch (cause) {
      notifyFailure(cause, statusUpdateBusiness);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 md:mx-0 desktop:max-w-5xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold text-ink md:text-[1.75rem]">Vos offres</h1>
          <p className="text-sm text-ink-muted">Publiez vos postes et suivez qui s’y intéresse.</p>
        </div>

        <Link to={NEW_OFFER_PATH} className={cn(PRIMARY_ACTION, 'w-full md:w-auto')}>
          <Plus aria-hidden="true" />
          Nouvelle offre
        </Link>
      </div>

      {/* A segmented control rather than a select: six values fit on a line
          and a filter is read at a glance. Pressed buttons rather than tabs —
          it narrows one list, it does not switch between panels. Scrolls
          sideways inside its own track on the narrowest screens. */}
      <div
        role="group"
        aria-label="Filtrer par statut"
        className="flex gap-1 self-stretch overflow-x-auto rounded-xl bg-surface p-1 [scrollbar-width:none] md:self-start"
      >
        {FILTERS.map((filter) => {
          const active = filter.value === statusFilter;

          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={active}
              onClick={() => setStatusFilter(filter.value)}
              className={cn(
                'h-10 shrink-0 cursor-pointer rounded-lg px-3.5 text-sm font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-brand/30',
                active ? 'bg-card text-ink shadow-card' : 'text-ink-muted hover:text-ink',
              )}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {status === 'loading' && (
        <div className="flex flex-col gap-3">
          <p role="status" className="text-sm text-ink-muted">
            Chargement de vos offres…
          </p>
          <div aria-hidden="true" className="h-28 animate-pulse rounded-2xl bg-surface" />
          <div aria-hidden="true" className="h-28 animate-pulse rounded-2xl bg-surface" />
        </div>
      )}

      {status === 'failed' && (
        <p role="alert" className="text-sm text-destructive">
          Impossible de charger vos offres.{' '}
          <button
            type="button"
            onClick={reload}
            className="cursor-pointer font-semibold underline underline-offset-4"
          >
            Réessayer
          </button>
        </p>
      )}

      {status === 'ready' &&
        offers.length === 0 &&
        // Two different silences: no offer at all is an invitation to start,
        // whereas a filter that matches nothing must not suggest the company
        // has never published anything.
        (statusFilter === 'all' ? (
          <EmptyState
            icon={<Briefcase aria-hidden="true" />}
            title="Aucune offre pour l’instant"
            text="Vous n’avez pas encore publié d’offre."
            action={
              <Link to={NEW_OFFER_PATH} className={PRIMARY_ACTION}>
                <Plus aria-hidden="true" />
                Créer ma première offre
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<ListFilter aria-hidden="true" />}
            title="Rien à afficher"
            text="Aucune offre avec ce statut."
            action={
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl px-5"
                onClick={() => setStatusFilter('all')}
              >
                Voir toutes les offres
              </Button>
            }
          />
        ))}

      {status === 'ready' && truncated && (
        // Said out loud rather than left to be guessed: without it a recruiter
        // reading a full page has no way to tell it from their whole list.
        // `note` rather than `status`: the sentence never changes on its own,
        // and every badge in the list below is already a live region.
        <p role="note" className="text-sm text-ink-muted">
          Seules les {OFFERS_PAGE_SIZE} offres les plus récentes sont affichées ; il en existe
          d’autres.
        </p>
      )}

      {status === 'ready' && offers.length > 0 && (
        <ul aria-label="Offres de votre société" className="flex flex-col gap-3">
          {offers.map((offer) => (
            <OfferRow
              key={offer.id}
              offer={offer}
              statusPending={pendingId === offer.id}
              onStatusChange={(next) => void changeStatus(offer.id, next)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
