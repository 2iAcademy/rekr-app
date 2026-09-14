import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '@/api/customFetch';
import {
  offerControllerCreate,
  offerControllerFindOneById,
  offerControllerUpdate,
} from '@/api/generated';
import { Button } from '@/components/ui/button';
import { OfferForm } from '@/features/recruiter-offers/components/OfferForm';
import {
  buildOfferPayload,
  emptyOfferForm,
  offerFormFromDetail,
  type OfferFormValue,
} from '@/features/recruiter-offers/offerPayload';
import { firstOfferError, type OfferFormError } from '@/features/recruiter-offers/offerValidation';
import type { BusinessMessages } from '@/lib/feedback/failureMessage';
import { notifyFailure, notifySuccess } from '@/lib/feedback/notify';

const OFFERS_PATH = '/recruteur/offres';

export const OFFER_CREATE_SUCCESS = 'L’offre est créée.';
export const OFFER_UPDATE_SUCCESS = 'L’offre est enregistrée.';

/**
 * The API answers 404 both for an offer that no longer exists and for one owned
 * by another company — deliberately, so that nobody can enumerate identifiers.
 * The wording keeps that ambiguity instead of picking a story.
 */
export const OFFER_GONE =
  'Cette offre est introuvable : elle a peut-être été supprimée, ou elle n’appartient pas à votre société.';

export const NO_COMPANY =
  'Votre société n’est pas encore renseignée. Complétez votre fiche société avant de publier une offre.';

const REFUSED_INPUT = 'Certaines informations sont refusées. Vérifiez les champs du formulaire.';

/**
 * Same status, two meanings: on a creation a 404 says the recruiter is attached
 * to no company at all, on a patch it says the offer is out of reach. One map
 * each, so neither answer borrows the other's wording.
 */
const offerCreateBusiness: BusinessMessages = {
  400: REFUSED_INPUT,
  404: NO_COMPANY,
};

const offerUpdateBusiness: BusinessMessages = {
  400: REFUSED_INPUT,
  404: OFFER_GONE,
};

type Status = 'loading' | 'ready' | 'missing' | 'failed';

interface Screen {
  /**
   * Which URL — and which load attempt — this state belongs to. Comparing it to
   * the current one during render is what resets the screen when the recruiter
   * moves between offers or asks for a retry, without an effect having to write
   * state on its own and cascade a render.
   */
  key: string;
  status: Status;
  form: OfferFormValue;
  error: OfferFormError | null;
}

// `Number` is far too forgiving here — `Number('')` is 0 and `Number(' 3 ')` is
// 3 — so a bare run of digits is the only thing that counts as an identifier.
const parseOfferId = (raw: string | undefined): number | null => {
  if (raw === undefined || !/^\d+$/.test(raw)) {
    return null;
  }

  const id = Number(raw);

  return id > 0 ? id : null;
};

/**
 * Creation and edition are the same screen, told apart by the presence of an
 * offer identifier in the URL: the fields, their rules and their wording are the
 * same, only the source of the initial value and the endpoint change.
 */
export function OfferFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const editing = id !== undefined;
  const offerId = parseOfferId(id);
  const [attempt, setAttempt] = useState(0);
  const key = `${id ?? 'new'}#${String(attempt)}`;

  const blank = (): Screen => ({
    key,
    // An identifier that is not a number cannot name an offer, so it is answered
    // as missing straight away rather than asked about.
    status: !editing ? 'ready' : offerId === null ? 'missing' : 'loading',
    form: emptyOfferForm,
    error: null,
  });

  const [screen, setScreen] = useState<Screen>(blank);
  const [saving, setSaving] = useState(false);

  const current = screen.key === key ? screen : blank();

  const write = (change: (previous: Screen) => Screen): void =>
    setScreen((previous) => change(previous.key === key ? previous : blank()));

  useEffect(() => {
    if (offerId === null) {
      return;
    }

    let cancelled = false;

    void offerControllerFindOneById(offerId)
      .then((response) => {
        if (cancelled) {
          return;
        }

        setScreen({
          key,
          status: 'ready',
          form: offerFormFromDetail(response.data),
          error: null,
        });
      })
      .catch((cause: unknown) => {
        if (cancelled) {
          return;
        }

        setScreen({
          key,
          status: cause instanceof ApiError && cause.status === 404 ? 'missing' : 'failed',
          form: emptyOfferForm,
          error: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [key, offerId]);

  const patch = (fields: Partial<OfferFormValue>): void =>
    write((previous) => ({ ...previous, form: { ...previous.form, ...fields } }));

  const submit = async (): Promise<void> => {
    const failure = firstOfferError(current.form);
    write((previous) => ({ ...previous, error: failure }));
    if (failure !== null) {
      return;
    }

    setSaving(true);

    try {
      const payload = buildOfferPayload(current.form, offerId === null ? 'create' : 'update');

      if (offerId === null) {
        await offerControllerCreate(payload);
      } else {
        await offerControllerUpdate(offerId, payload);
      }

      notifySuccess(offerId === null ? OFFER_CREATE_SUCCESS : OFFER_UPDATE_SUCCESS);
      // Nothing to adopt from the answer: the list is the only place the saved
      // offer is shown again, and it loads it itself.
      void navigate(OFFERS_PATH);
    } catch (cause) {
      notifyFailure(cause, offerId === null ? offerCreateBusiness : offerUpdateBusiness);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="desktop:max-w-5xl mx-auto max-w-3xl md:mx-0 lg:max-w-4xl">
      <Link
        to={OFFERS_PATH}
        className="mt-5 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink md:mt-0"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Retour à mes offres
      </Link>

      <h1 className="mt-3 font-heading text-xl font-bold text-ink md:text-2xl">
        {editing ? 'Modifier l’offre' : 'Nouvelle offre'}
      </h1>

      {current.status === 'loading' && (
        <p role="status" className="mt-6 text-sm text-ink-muted">
          Chargement de l’offre…
        </p>
      )}

      {current.status === 'missing' && (
        <p
          role="alert"
          className="mt-6 rounded-2xl border border-line bg-card p-5 text-sm text-ink"
        >
          {OFFER_GONE}
        </p>
      )}

      {current.status === 'failed' && (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-line bg-card p-5">
          <p role="alert" className="text-sm text-destructive">
            Impossible de charger cette offre.
          </p>
          <Button variant="soft" size="lg" onClick={() => setAttempt((count) => count + 1)}>
            Réessayer
          </Button>
        </div>
      )}

      {current.status === 'ready' && (
        <div className="mt-8">
          <OfferForm
            value={current.form}
            onChange={patch}
            onSubmit={() => void submit()}
            submitting={saving}
            submitLabel={editing ? 'Enregistrer' : 'Créer l’offre'}
            error={current.error}
          />
        </div>
      )}
    </div>
  );
}
