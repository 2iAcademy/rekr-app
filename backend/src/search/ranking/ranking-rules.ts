import {
  ContractType,
  ExperienceLevel,
  RemotePolicy,
} from '../../../generated/prisma/client';

/**
 * Every number the candidate feed ranks with, in one file.
 *
 * The ranking is a product decision, not a relevance model: nothing here is
 * learned, tuned against a dataset or hidden in a query. Changing how the deck
 * is ordered means changing a number below, and the builder in
 * `offer-ranking.ts` turns whatever is here into an Elasticsearch query.
 *
 * Two kinds of rules, deliberately kept apart:
 *
 *  - A **filter** removes an offer. Reserved for the axes where no score is low
 *    enough to be worth showing — the trade, and a remote policy the candidate
 *    cannot accommodate.
 *  - A **weight** orders what is left. Every weight below is the maximum an
 *    axis can contribute; an axis never subtracts.
 */

/**
 * The most each axis can contribute, and therefore how much each one matters
 * relative to the others. Only the ratios are meaningful — scaling them all by
 * the same factor changes nothing.
 */
export const CRITERION_WEIGHTS = {
  /** What separates two offers of the same trade. */
  skills: 5,
  /** A junior on a lead role is a lost application on both sides. */
  experience: 4,
  contractType: 3,
  salary: 3,
  /** A physical constraint, not a preference: it decides little, but it decides. */
  location: 1,
  /**
   * Zero, so remote work only ever excludes — which is all the source table
   * asked of it, and it keeps the six weights above summing to the scale that
   * table set. `REMOTE_AFFINITY` already grades the pairs it allows: raise this
   * to 1 and an hybrid candidate starts preferring an hybrid post to a fully
   * remote one, without another line changing.
   */
  remotePolicy: 0,
  /** A three-month-old post is often already filled. */
  freshness: 1,
} as const;

/** The highest total an offer can reach — 17 with the weights above. */
export const MAX_RANKING_SCORE = Object.values(CRITERION_WEIGHTS).reduce(
  (total, weight) => total + weight,
  0,
);

/**
 * `null` is an exclusion: the pair is not a worse match, it is not a match at
 * all. Used by the contract matrix, where apprenticeships and internships are a
 * status rather than a preference — someone looking for a CDI is not served a
 * six-month internship because nothing better was in stock, and the reverse
 * holds just as strongly.
 */
export type Affinity = number | null;

/**
 * How well the contract an offer proposes answers the one a candidate wants.
 *
 * Read as `CONTRACT_AFFINITY[what the candidate wants][what the offer
 * proposes]`. The upper-left block is asymmetric on purpose: someone who will
 * take a three-month mission also takes a permanent contract, so every row
 * scores CDI highly, while the reverse is not true.
 */
export const CONTRACT_AFFINITY: Record<
  ContractType,
  Record<ContractType, Affinity>
> = {
  CDI: {
    CDI: 3,
    CDD: 2,
    INTERIM: 1,
    FREELANCE: 0,
    ALTERNANCE: null,
    STAGE: null,
  },
  CDD: {
    CDI: 3,
    CDD: 3,
    INTERIM: 2,
    FREELANCE: 0,
    ALTERNANCE: null,
    STAGE: null,
  },
  INTERIM: {
    CDI: 3,
    CDD: 3,
    INTERIM: 3,
    FREELANCE: 0,
    ALTERNANCE: null,
    STAGE: null,
  },
  FREELANCE: {
    CDI: 0,
    CDD: 0,
    INTERIM: 0,
    FREELANCE: 3,
    ALTERNANCE: null,
    STAGE: null,
  },
  ALTERNANCE: {
    CDI: null,
    CDD: null,
    INTERIM: null,
    FREELANCE: null,
    ALTERNANCE: 3,
    STAGE: 1,
  },
  STAGE: {
    CDI: null,
    CDD: null,
    INTERIM: null,
    FREELANCE: null,
    ALTERNANCE: 1,
    STAGE: 3,
  },
};

/**
 * Whether the arrangement an offer proposes is one the candidate can hold.
 *
 * Read as `REMOTE_AFFINITY[what the candidate asked for][what the offer
 * proposes]`. Unlike the contract, this is an order rather than a partition,
 * so its exclusions are deliberately **not** symmetric: asking to work
 * remotely is usually being unable to come on site, and that inability only
 * points one way.
 *
 * Someone who asked for hybrid can hold a fully remote post — they were
 * offering to come in, not requiring it — while someone who cannot come in at
 * all is not served an hybrid one. Someone who asked to be on site is
 * constrained by nothing and sees everything, ranked by what they asked for.
 */
export const REMOTE_AFFINITY: Record<
  RemotePolicy,
  Record<RemotePolicy, Affinity>
> = {
  ON_SITE: { ON_SITE: 3, HYBRID: 2, FULL_REMOTE: 1 },
  HYBRID: { ON_SITE: null, HYBRID: 3, FULL_REMOTE: 2 },
  FULL_REMOTE: { ON_SITE: null, HYBRID: null, FULL_REMOTE: 3 },
};

/**
 * How well a candidate's seniority answers what an offer asks for.
 *
 * Read as `EXPERIENCE_AFFINITY[the candidate's level][the level the offer
 * asks for]`. Being over-qualified costs less than being under-qualified: an
 * expert can hold a junior post, a junior cannot hold a senior one.
 *
 * The EXPERT column is an extrapolation — the source table stopped at SENIOR.
 * It follows the gap the other three columns encode (same level or one above:
 * full marks; two or more above: half; one below: half; two or more below:
 * nothing), which is where the value 0 for CONFIRME comes from.
 */
export const EXPERIENCE_AFFINITY: Record<
  ExperienceLevel,
  Record<ExperienceLevel, number>
> = {
  JUNIOR: { JUNIOR: 4, CONFIRME: 2, SENIOR: 0, EXPERT: 0 },
  CONFIRME: { JUNIOR: 4, CONFIRME: 4, SENIOR: 2, EXPERT: 0 },
  SENIOR: { JUNIOR: 2, CONFIRME: 4, SENIOR: 4, EXPERT: 2 },
  EXPERT: { JUNIOR: 2, CONFIRME: 2, SENIOR: 4, EXPERT: 4 },
};

/**
 * What an axis is worth when the offer never filled it in.
 *
 * An offer that did not say is not an offer that says no — dropping it would
 * hide posts from every candidate who did fill the field in. It scores the
 * middle of its scale rather than zero, so it neither wins nor is buried.
 */
export const UNSPECIFIED_OFFER_AFFINITY = {
  contractType: 1.5,
  experience: 2,
} as const;

/** How the salary an offer publishes is turned into points. */
export const SALARY_RULES = {
  /**
   * What an offer scores when it published no salary at all. Kept low rather
   * than neutral: silence on pay is itself a signal, and candidates say so.
   */
  unspecifiedRatio: 0.25,
} as const;

/** How distance is turned into points, for a candidate who is not nationwide. */
export const LOCATION_RULES = {
  /** Distance under which the offer loses nothing, in kilometres. */
  fullCreditKm: 10,
  /**
   * Where the score has fallen to `decay`. The candidate's own mobility radius
   * is used when they gave one, this is the fallback.
   */
  defaultRadiusKm: 30,
  decay: 0.5,
  /** An offer with no coordinates keeps this share of the weight. */
  unspecifiedRatio: 0.5,
} as const;

/** How age is turned into points. */
export const FRESHNESS_RULES = {
  /** Age under which an offer is simply fresh. */
  fullCreditDays: 7,
  /** Age at which it has fallen to `decay` — three months is often filled. */
  halfLifeDays: 45,
  decay: 0.5,
} as const;

/**
 * How many of the candidate's skills are scored at most.
 *
 * `MAX_SKILLS` allows fifty, and each one becomes a clause in the query. The
 * cap keeps a maximal profile from building a query an order of magnitude
 * larger than a typical one; the skills beyond it simply do not score.
 */
export const MAX_SCORED_SKILLS = 20;
