import { describe, expect, it } from 'vitest';
import {
  isOfferStatus,
  OFFER_STATUS_OPTIONS,
  OFFER_STATUSES,
  offerStatusLabel,
  offerStatusTone,
  type OfferStatus,
  type OfferStatusTone,
} from './offerStatus';

// The wording and the colour coding the PO signed off on, restated here as
// data: the source can no longer be reworded without the decision being made
// again. Typed as a total `Record`, so a status added to `OFFER_STATUSES`
// without a label and a tone breaks this file at compile time — the missing
// case cannot slip through as an untested status.
const EXPECTED: Record<OfferStatus, { label: string; tone: OfferStatusTone }> = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  open: { label: 'Publiée', tone: 'positive' },
  paused: { label: 'En pause', tone: 'warning' },
  filled: { label: 'Pourvue', tone: 'muted' },
  closed: { label: 'Fermée', tone: 'muted' },
};

describe('statuts d’offre', () => {
  it.each(OFFER_STATUSES)('traduit et colore le statut « %s »', (status) => {
    expect(offerStatusLabel(status)).toBe(EXPECTED[status].label);
    expect(offerStatusTone(status)).toBe(EXPECTED[status].tone);
  });

  // The backend keeps `status` a free field of the PATCH, so this list is the
  // only place the five values are enumerated for the whole front.
  it('énumère les cinq statuts du contrat, dans l’ordre du cycle de vie', () => {
    expect([...OFFER_STATUSES]).toEqual(['draft', 'open', 'paused', 'filled', 'closed']);
  });

  it('donne un libellé non vide à chaque statut déclaré', () => {
    for (const status of OFFER_STATUSES) {
      expect(offerStatusLabel(status).trim()).not.toBe('');
    }
  });

  it('n’utilise pas deux fois le même libellé', () => {
    const labels = OFFER_STATUSES.map(offerStatusLabel);

    expect(new Set(labels).size).toBe(labels.length);
  });

  // The tone drives a colour, not a meaning: two statuses may share one. What
  // must not happen is a status carrying a tone the badge has no style for.
  it('n’attribue que des tonalités connues du design system', () => {
    for (const status of OFFER_STATUSES) {
      expect(['neutral', 'positive', 'warning', 'muted']).toContain(offerStatusTone(status));
    }
  });
});

describe('options de statut d’offre', () => {
  it('propose une option par statut, dans l’ordre déclaré', () => {
    expect(OFFER_STATUS_OPTIONS.map((option) => option.value)).toEqual([...OFFER_STATUSES]);
  });

  it('réutilise le libellé officiel de chaque statut', () => {
    expect(OFFER_STATUS_OPTIONS.map((option) => option.label)).toEqual(
      OFFER_STATUSES.map(offerStatusLabel),
    );
  });
});

// The API types `status` as a plain string, so the value reaching the badge has
// to be narrowed somewhere. Keeping that check here rather than at each call
// site is what stops the screens from casting their way past it.
describe('reconnaissance d’un statut d’offre', () => {
  it.each(OFFER_STATUSES)('accepte « %s »', (status) => {
    expect(isOfferStatus(status)).toBe(true);
  });

  // `published` is deliberately in the list: the vocabulary says « publier » but
  // the value is `open`, and nothing else must be accepted under that name.
  it.each(['', 'published', 'archived', 'Open', 'OPEN', ' open'])(
    'refuse une valeur inattendue (%j)',
    (value) => {
      expect(isOfferStatus(value)).toBe(false);
    },
  );
});
