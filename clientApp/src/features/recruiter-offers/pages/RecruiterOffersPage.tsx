import { useId } from 'react';
import { Link } from 'react-router';
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

/**
 * The recruiter's offers, all statuses confounded, with the status of each one
 * changeable in place.
 *
 * Rendered inside `AppShell`, which owns the `main` landmark, the page padding
 * and the `data-role` palette; the URL, the role guard and the create/edit
 * screens belong to the routes. The page takes no props: everything it shows
 * comes from `useOffers`, and the tests drive it through the mocked client
 * rather than through an injected list.
 *
 * Layout: one column on mobile, the header splitting into a title and a call to
 * action from `md:` up, and a wider measure past `desktop:` so the rows do not
 * stretch into an unreadable line on a 1440 screen.
 */
export function RecruiterOffersPage() {
  const filterId = useId();
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
    <div className="mx-auto mt-5 flex w-full max-w-3xl flex-col gap-5 md:mx-0 md:mt-0 desktop:max-w-5xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="font-heading text-xl font-bold text-ink md:text-2xl">Vos offres</h1>

        <Link
          to={NEW_OFFER_PATH}
          className={cn(
            buttonVariants({ variant: 'role', size: 'lg' }),
            'h-11 justify-center px-5',
          )}
        >
          Créer une offre
        </Link>
      </div>

      <div className="flex flex-col gap-1.5 md:max-w-xs">
        <label htmlFor={filterId} className="text-xs text-ink-muted">
          Filtrer par statut
        </label>
        <select
          id={filterId}
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as OfferStatusFilter)}
          className={cn(
            'h-11 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink outline-none transition-colors',
            'focus-visible:border-role focus-visible:ring-3 focus-visible:ring-role/20',
          )}
        >
          <option value="all">Tous les statuts</option>
          {OFFER_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {status === 'loading' && (
        <p role="status" className="text-sm text-ink-muted">
          Chargement de vos offres…
        </p>
      )}

      {status === 'failed' && (
        <p role="alert" className="text-sm text-destructive">
          Impossible de charger vos offres.{' '}
          <button type="button" onClick={reload} className="cursor-pointer underline">
            Réessayer
          </button>
        </p>
      )}

      {status === 'ready' && offers.length === 0 && (
        // Two different silences: no offer at all is an invitation to start,
        // whereas a filter that matches nothing must not suggest the company
        // has never published anything.
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line bg-card p-6">
          {statusFilter === 'all' ? (
            <>
              <p className="text-sm text-ink-muted">Vous n’avez pas encore publié d’offre.</p>
              <Link
                to={NEW_OFFER_PATH}
                className={cn(
                  buttonVariants({ variant: 'role', size: 'lg' }),
                  'h-11 justify-center px-5',
                )}
              >
                Créer ma première offre
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-muted">Aucune offre avec ce statut.</p>
              <Button type="button" variant="outline" onClick={() => setStatusFilter('all')}>
                Voir toutes les offres
              </Button>
            </>
          )}
        </div>
      )}

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
