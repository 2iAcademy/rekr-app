import type {
  QueryDslFunctionScoreContainer,
  QueryDslQueryContainer,
} from '@elastic/elasticsearch/lib/api/types';
import {
  ContractType,
  ExperienceLevel,
  RemotePolicy,
} from '../../../generated/prisma/client';
import {
  CONTRACT_AFFINITY,
  CRITERION_WEIGHTS,
  EXPERIENCE_AFFINITY,
  FRESHNESS_RULES,
  LOCATION_RULES,
  MAX_SCORED_SKILLS,
  REMOTE_AFFINITY,
  SALARY_RULES,
  UNSPECIFIED_OFFER_AFFINITY,
  type Affinity,
} from './ranking-rules';

/**
 * Turns the rules in `ranking-rules.ts` into the query the candidate feed runs.
 *
 * Kept free of the Elasticsearch client so the ranking can be asserted from a
 * unit test: what goes in is a profile, what comes out is a plain object. The
 * service does nothing to it but send it.
 */

/** Everything the ranking reads about the candidate, and nothing else. */
export interface CandidateRankingProfile {
  jobFamilyIds: number[];
  /**
   * The trade the candidate ranked first, or `null` when there is nothing to
   * prefer — a single trade, or an account whose trades were never ranked.
   */
  primaryJobFamilyId: number | null;
  skills: string[];
  contractTypes: ContractType[];
  experienceLevel: ExperienceLevel | null;
  remotePolicy: RemotePolicy | null;
  salaryMin: number | null;
  salaryMax: number | null;
  latitude: number | null;
  longitude: number | null;
  mobilityRadiusKm: number | null;
  mobilityNationwide: boolean | null;
}

/** A trade the candidate named, with the place they gave it. */
export interface RankedJobFamily {
  jobFamilyId: number;
  rank: number;
}

/**
 * The trade to lift above the others, or `null` when there is none to prefer.
 *
 * A single trade has nothing to be preferred over. Several trades sharing the
 * lowest rank are the accounts written before the rank existed: the migration
 * could not recover an intention, and electing one of them would boost a trade
 * the candidate never chose.
 */
export const primaryJobFamilyOf = (
  families: RankedJobFamily[],
): number | null => {
  if (families.length < 2) return null;

  const lowest = Math.min(...families.map(({ rank }) => rank));
  const first = families.filter(({ rank }) => rank === lowest);

  return first.length === 1 ? first[0].jobFamilyId : null;
};

export interface OfferRankingQuery {
  /** Hard rules. An offer failing any of these never reaches the deck. */
  filter: QueryDslQueryContainer[];
  /** Soft rules. Each contributes at most its weight, and never subtracts. */
  functions: QueryDslFunctionScoreContainer[];
}

const CONTRACT_TYPES = Object.keys(CONTRACT_AFFINITY) as ContractType[];
const REMOTE_POLICIES = Object.keys(REMOTE_AFFINITY) as RemotePolicy[];

/** Lets a caller tell « every arrangement is allowed » from a restriction. */
export const REMOTE_POLICY_COUNT = REMOTE_POLICIES.length;

/** Lets a caller tell « every contract is allowed » from a real restriction. */
export const CONTRACT_TYPE_COUNT = CONTRACT_TYPES.length;
const EXPERIENCE_LEVELS = Object.keys(EXPERIENCE_AFFINITY) as ExperienceLevel[];

/**
 * The highest value each matrix holds, so that a weight and a matrix can be
 * retuned independently: raising `CRITERION_WEIGHTS.contractType` widens the
 * gap between a good and a bad contract without anyone having to rescale the
 * matrix itself.
 */
const maxOf = (matrix: Record<string, Record<string, Affinity>>): number =>
  Math.max(
    ...Object.values(matrix).flatMap((row) =>
      Object.values(row).filter((value): value is number => value !== null),
    ),
  );

const MAX_CONTRACT_AFFINITY = maxOf(CONTRACT_AFFINITY);
const MAX_EXPERIENCE_AFFINITY = maxOf(EXPERIENCE_AFFINITY);
const MAX_REMOTE_AFFINITY = maxOf(REMOTE_AFFINITY);

/** Rounded because a float in a query is noise in every log that echoes it. */
const points = (share: number, weight: number): number =>
  Math.round(share * weight * 1000) / 1000;

export const buildOfferRankingQuery = (
  profile: CandidateRankingProfile,
): OfferRankingQuery => ({
  filter: [
    { term: { status: 'open' } },
    ...jobFamilyFilter(profile),
    ...remotePolicyFilter(profile),
    ...contractTypeFilter(profile),
  ],
  functions: [
    ...skillFunctions(profile),
    ...jobFamilyFunctions(profile),
    ...remotePolicyFunctions(profile),
    ...experienceFunctions(profile),
    ...contractTypeFunctions(profile),
    ...salaryFunctions(profile),
    ...locationFunctions(profile),
    ...freshnessFunctions(),
  ],
});

/**
 * The trade excludes rather than scores: nobody changes career because an
 * unrelated post pays well. A candidate who named none is left unfiltered, and
 * an offer carrying no trade is dropped as soon as one is named — an unknown
 * trade is not a wildcard.
 */
const jobFamilyFilter = ({
  jobFamilyIds,
}: CandidateRankingProfile): QueryDslQueryContainer[] =>
  jobFamilyIds.length > 0 ? [{ terms: { jobFamilyId: jobFamilyIds } }] : [];

/**
 * The primary trade orders, it never narrows: the filter above keeps every
 * trade the candidate named, and this only lifts the one they ranked first.
 * A primary missing from the filter is ignored — it would score offers the
 * deck never shows.
 */
const jobFamilyFunctions = ({
  jobFamilyIds,
  primaryJobFamilyId,
}: CandidateRankingProfile): QueryDslFunctionScoreContainer[] =>
  primaryJobFamilyId !== null && jobFamilyIds.includes(primaryJobFamilyId)
    ? [
        {
          filter: { term: { jobFamilyId: primaryJobFamilyId } },
          weight: CRITERION_WEIGHTS.jobFamily,
        },
      ]
    : [];

/**
 * Asking for remote work is usually being unable to come on site — a child to
 * collect, a dependent relative, a home too far away. It is a constraint, so it
 * still filters, but on what the candidate can actually hold rather than on a
 * literal match: `REMOTE_AFFINITY` says an hybrid candidate can take a fully
 * remote post, and testing equality was hiding those from them.
 *
 * Only once the candidate has answered: silence is not a requirement. An offer
 * that never said stays, on the same reading as everywhere else.
 */
const remotePolicyFilter = ({
  remotePolicy,
}: CandidateRankingProfile): QueryDslQueryContainer[] => {
  if (!remotePolicy) return [];

  const allowed = allowedRemotePolicies(remotePolicy);
  if (allowed.length === REMOTE_POLICIES.length) return [];

  return [
    {
      bool: {
        should: [
          { terms: { remotePolicy: allowed } },
          { bool: { must_not: [{ exists: { field: 'remotePolicy' } }] } },
        ],
        minimum_should_match: 1,
      },
    },
  ];
};

/**
 * The arrangements a candidate can be shown at all.
 *
 * Exported for the same reason as `allowedContractTypes`: the ranked page is
 * topped up straight from PostgreSQL, and that top-up has to honour the same
 * exclusion.
 */
export const allowedRemotePolicies = (
  wanted: RemotePolicy | null,
): RemotePolicy[] =>
  wanted === null
    ? REMOTE_POLICIES
    : REMOTE_POLICIES.filter(
        (offered) => REMOTE_AFFINITY[wanted][offered] !== null,
      );

/**
 * Ranks the arrangements the filter above let through — weightless by default,
 * so it emits nothing until `CRITERION_WEIGHTS.remotePolicy` is raised.
 */
const remotePolicyFunctions = ({
  remotePolicy,
}: CandidateRankingProfile): QueryDslFunctionScoreContainer[] => {
  const weight = CRITERION_WEIGHTS.remotePolicy;
  if (!remotePolicy || weight === 0) return [];

  const row = REMOTE_AFFINITY[remotePolicy];

  return REMOTE_POLICIES.flatMap((offered) => {
    const affinity = row[offered];
    if (affinity === null || affinity === 0) return [];

    return [
      {
        filter: { term: { remotePolicy: offered } },
        weight: points(affinity / MAX_REMOTE_AFFINITY, weight),
      },
    ];
  });
};

/**
 * The contract orders rather than filters — with one exception the matrix
 * spells out as `null`: apprenticeships and internships are a status, not a
 * preference, and neither side of that line is served by the other.
 */
const contractTypeFilter = (
  profile: CandidateRankingProfile,
): QueryDslQueryContainer[] => {
  if (profile.contractTypes.length === 0) return [];

  const allowed = allowedContractTypes(profile.contractTypes);

  return [
    {
      bool: {
        should: [
          { terms: { contractType: allowed } },
          { bool: { must_not: [{ exists: { field: 'contractType' } }] } },
        ],
        minimum_should_match: 1,
      },
    },
  ];
};

/**
 * The contracts a candidate may be shown at all — every one the matrix does not
 * mark as an exclusion.
 *
 * Exported because Elasticsearch is not the only path into the deck: PostgreSQL
 * tops the ranked page up with freshly published offers, and that top-up has to
 * honour the same exclusion. Were it not shared, an internship could enter the
 * deck of someone looking for a permanent contract purely because its document
 * had not been indexed yet.
 */
export const allowedContractTypes = (wanted: ContractType[]): ContractType[] =>
  wanted.length === 0
    ? CONTRACT_TYPES
    : CONTRACT_TYPES.filter(
        (offered) => contractAffinity(wanted, offered) !== null,
      );

/**
 * A candidate may accept several contracts. The best row wins, and a pair is
 * only excluded when every contract they accept excludes it — otherwise ticking
 * one extra box would narrow the deck instead of widening it.
 */
const contractAffinity = (
  wanted: ContractType[],
  offered: ContractType,
): Affinity => {
  const scores = wanted
    .map((want) => CONTRACT_AFFINITY[want][offered])
    .filter((score): score is number => score !== null);

  return scores.length === 0 ? null : Math.max(...scores);
};

const contractTypeFunctions = (
  profile: CandidateRankingProfile,
): QueryDslFunctionScoreContainer[] => {
  if (profile.contractTypes.length === 0) return [];

  const weight = CRITERION_WEIGHTS.contractType;
  const scored = CONTRACT_TYPES.flatMap((offered) => {
    const affinity = contractAffinity(profile.contractTypes, offered);
    if (affinity === null || affinity === 0) return [];

    return [
      {
        filter: { term: { contractType: offered } },
        weight: points(affinity / MAX_CONTRACT_AFFINITY, weight),
      },
    ];
  });

  return [
    ...scored,
    missingFieldFunction(
      'contractType',
      points(
        UNSPECIFIED_OFFER_AFFINITY.contractType / MAX_CONTRACT_AFFINITY,
        weight,
      ),
    ),
  ];
};

/**
 * Seniority scores, it never excludes: a confirmed developer reading a senior
 * post is a stretch, not an error. A candidate who did not say their level
 * leaves the axis out entirely rather than guessing one.
 */
const experienceFunctions = ({
  experienceLevel,
}: CandidateRankingProfile): QueryDslFunctionScoreContainer[] => {
  if (!experienceLevel) return [];

  const weight = CRITERION_WEIGHTS.experience;
  const row = EXPERIENCE_AFFINITY[experienceLevel];
  const scored = EXPERIENCE_LEVELS.flatMap((asked) =>
    row[asked] === 0
      ? []
      : [
          {
            filter: { term: { minExperienceLevel: asked } },
            weight: points(row[asked] / MAX_EXPERIENCE_AFFINITY, weight),
          },
        ],
  );

  return [
    ...scored,
    missingFieldFunction(
      'minExperienceLevel',
      points(
        UNSPECIFIED_OFFER_AFFINITY.experience / MAX_EXPERIENCE_AFFINITY,
        weight,
      ),
    ),
  ];
};

/**
 * Skills are what separate two offers of the same trade, so they carry the most
 * weight — and they are shared out rather than granted wholesale: an offer
 * matching one skill out of five must not score like one matching all five.
 *
 * Each skill is worth an equal share of the weight, which means the axis
 * measures how much of the candidate's skill set the offer actually uses.
 */
const skillFunctions = ({
  skills,
}: CandidateRankingProfile): QueryDslFunctionScoreContainer[] => {
  const scored = skills.slice(0, MAX_SCORED_SKILLS);
  if (scored.length === 0) return [];

  const share = 1 / scored.length;

  return scored.map((skill) => ({
    filter: { term: { skills: skill } },
    weight: points(share, CRITERION_WEIGHTS.skills),
  }));
};

/**
 * How far up the candidate's expectation the offer reaches.
 *
 * Measured on the top of the offer's range rather than on how much the two
 * ranges overlap, which is the only reading that survives its own examples: an
 * offer at 32–45 k€ scores nothing against someone asking 45–60 k€, one at
 * 45–60 k€ scores full, and one at 55–70 k€ scores full as well. Overlap would
 * have ranked that last one *below* an offer paying less, for the sole reason
 * that it does not cover the bottom of a range the candidate only ever set as
 * a floor.
 *
 * Computed in the shard so the curve stays in `SALARY_RULES` rather than being
 * bucketed into range clauses. Every value is a bound parameter.
 */
const SALARY_SCRIPT = `
double weight = params.weight;
boolean hasMin = doc.containsKey('salaryMin') && doc['salaryMin'].size() > 0;
boolean hasMax = doc.containsKey('salaryMax') && doc['salaryMax'].size() > 0;
if (!hasMin && !hasMax) {
  return weight * params.unspecifiedRatio;
}
double offerTop = hasMax ? doc['salaryMax'].value : doc['salaryMin'].value;
if (offerTop >= params.wantedHigh) { return weight; }
if (offerTop <= params.wantedLow) { return 0.0; }
double span = params.wantedHigh - params.wantedLow;
if (span <= 0) { return 0.0; }
return weight * ((offerTop - params.wantedLow) / span);
`.trim();

const salaryFunctions = ({
  salaryMin,
  salaryMax,
}: CandidateRankingProfile): QueryDslFunctionScoreContainer[] => {
  if (salaryMin === null && salaryMax === null) return [];

  // `wantedLow` is the floor below which the offer is worth nothing and
  // `wantedHigh` the point at which it is worth everything. A candidate who
  // gave a single bound set both at once: reaching it is the whole answer.
  const wantedLow = salaryMin ?? salaryMax!;
  const wantedHigh = salaryMax ?? salaryMin!;

  return [
    {
      script_score: {
        script: {
          source: SALARY_SCRIPT,
          params: {
            wantedLow,
            wantedHigh,
            weight: CRITERION_WEIGHTS.salary,
            unspecifiedRatio: SALARY_RULES.unspecifiedRatio,
          },
        },
      },
    },
  ];
};

/**
 * Nobody commutes 86 km a day because the post pays well. The axis is worth
 * little, but what it is worth decays with distance rather than switching off
 * at the edge of the mobility radius — a post 31 km away is not worthless to
 * someone who said 30.
 *
 * A candidate open to the whole country drops the axis: distance tells them
 * nothing, and scoring it would rank their deck by a criterion they waived.
 */
const locationFunctions = ({
  latitude,
  longitude,
  mobilityRadiusKm,
  mobilityNationwide,
}: CandidateRankingProfile): QueryDslFunctionScoreContainer[] => {
  if (mobilityNationwide === true || latitude === null || longitude === null) {
    return [];
  }

  const weight = CRITERION_WEIGHTS.location;
  const scale = mobilityRadiusKm ?? LOCATION_RULES.defaultRadiusKm;

  return [
    {
      filter: { exists: { field: 'location' } },
      gauss: {
        location: {
          origin: { lat: latitude, lon: longitude },
          offset: `${LOCATION_RULES.fullCreditKm}km`,
          scale: `${Math.max(scale, 1)}km`,
          decay: LOCATION_RULES.decay,
        },
      },
      weight,
    },
    missingFieldFunction(
      'location',
      points(LOCATION_RULES.unspecifiedRatio, weight),
    ),
  ];
};

/** A three-month-old post is often already filled, so age costs a little. */
const freshnessFunctions = (): QueryDslFunctionScoreContainer[] => [
  {
    gauss: {
      createdAt: {
        origin: 'now',
        offset: `${FRESHNESS_RULES.fullCreditDays}d`,
        scale: `${FRESHNESS_RULES.halfLifeDays}d`,
        decay: FRESHNESS_RULES.decay,
      },
    },
    weight: CRITERION_WEIGHTS.freshness,
  },
];

/** The score an offer keeps on an axis it left blank. */
const missingFieldFunction = (
  field: string,
  weight: number,
): QueryDslFunctionScoreContainer => ({
  filter: { bool: { must_not: [{ exists: { field } }] } },
  weight,
});
