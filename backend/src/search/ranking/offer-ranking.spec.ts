import {
  CONTRACT_TYPE_COUNT,
  REMOTE_POLICY_COUNT,
  allowedContractTypes,
  allowedRemotePolicies,
  buildOfferRankingQuery,
  type CandidateRankingProfile,
} from './offer-ranking';
import type {
  ContractType,
  ExperienceLevel,
} from '../../../generated/prisma/client';
import {
  CONTRACT_AFFINITY,
  CRITERION_WEIGHTS,
  EXPERIENCE_AFFINITY,
  MAX_SCORED_SKILLS,
  REMOTE_AFFINITY,
} from './ranking-rules';

/**
 * The ranking is a product decision, so it is asserted as one: what follows
 * reads the query the feed would run, not a relevance figure.
 */

const profileOf = (
  overrides: Partial<CandidateRankingProfile> = {},
): CandidateRankingProfile => ({
  jobFamilyIds: [],
  skills: [],
  contractTypes: [],
  experienceLevel: null,
  remotePolicy: null,
  salaryMin: null,
  salaryMax: null,
  latitude: null,
  longitude: null,
  mobilityRadiusKm: null,
  mobilityNationwide: null,
  ...overrides,
});

type Weighted = { filter?: unknown; weight?: number };

/** Not every function carries a filter — freshness and salary apply to all. */
const filterOf = (fn: Weighted): string => JSON.stringify(fn.filter ?? {});

const weightFor = (
  profile: CandidateRankingProfile,
  matcher: (filter: string) => boolean,
): number | undefined => {
  const { functions } = buildOfferRankingQuery(profile);
  const found = (functions as Weighted[]).find((fn) => matcher(filterOf(fn)));

  return found?.weight;
};

const totalWeight = (profile: CandidateRankingProfile): number =>
  (buildOfferRankingQuery(profile).functions as Weighted[]).reduce(
    (sum, fn) => sum + (fn.weight ?? 0),
    0,
  );

describe('the matrices themselves', () => {
  // A missing cell is not a zero, it is a crash waiting for the one candidate
  // who ticked that box.
  it('answers every pair of contracts', () => {
    for (const row of Object.values(CONTRACT_AFFINITY)) {
      expect(Object.keys(row)).toHaveLength(CONTRACT_TYPE_COUNT);
    }
  });

  it('answers every pair of arrangements', () => {
    for (const row of Object.values(REMOTE_AFFINITY)) {
      expect(Object.keys(row)).toHaveLength(REMOTE_POLICY_COUNT);
    }
  });

  /**
   * Remote work is an order, not a partition, so its exclusions are asymmetric
   * where the contract's are symmetric — asserted rather than left to be read
   * as an oversight of the table above.
   */
  it('excludes remote pairs in one direction only', () => {
    expect(REMOTE_AFFINITY.HYBRID.FULL_REMOTE).not.toBeNull();
    expect(REMOTE_AFFINITY.FULL_REMOTE.HYBRID).toBeNull();
    expect(REMOTE_AFFINITY.ON_SITE.FULL_REMOTE).not.toBeNull();
    expect(REMOTE_AFFINITY.FULL_REMOTE.ON_SITE).toBeNull();
  });

  it('answers every pair of seniorities', () => {
    const levels = Object.keys(EXPERIENCE_AFFINITY);
    for (const row of Object.values(EXPERIENCE_AFFINITY)) {
      expect(Object.keys(row).sort()).toEqual(levels.sort());
    }
  });

  // The exclusion has to cut both ways, or a recruiter posting an internship
  // reaches candidates that the same rule keeps from reaching them.
  it('excludes contract pairs symmetrically', () => {
    const contracts = Object.keys(CONTRACT_AFFINITY) as ContractType[];
    for (const wanted of contracts) {
      for (const offered of contracts) {
        const affinity = CONTRACT_AFFINITY[wanted][offered];
        const mirrored = CONTRACT_AFFINITY[offered][wanted];
        expect(affinity === null).toBe(mirrored === null);
      }
    }
  });

  // Being over-qualified is a stretch; being two levels short is a lost
  // application on both sides. Nothing below the diagonal may outscore it.
  it('never scores a level above its own perfect match', () => {
    const levels = Object.keys(EXPERIENCE_AFFINITY) as ExperienceLevel[];
    for (const level of levels) {
      const row = EXPERIENCE_AFFINITY[level];
      for (const asked of levels) {
        expect(row[asked]).toBeLessThanOrEqual(row[level]);
      }
    }
  });
});

describe('what filters', () => {
  it('keeps the trade a hard filter and nothing else about it', () => {
    const { filter, functions } = buildOfferRankingQuery(
      profileOf({ jobFamilyIds: [13, 4] }),
    );

    expect(filter).toContainEqual({ terms: { jobFamilyId: [13, 4] } });
    expect(JSON.stringify(functions)).not.toContain('jobFamilyId');
  });

  it('leaves the deck unfiltered for a candidate who named no trade', () => {
    const { filter } = buildOfferRankingQuery(profileOf());

    expect(JSON.stringify(filter)).not.toContain('jobFamilyId');
  });

  // Remote work is usually an inability to come on site, so it still filters —
  // but only once the candidate has answered.
  it('filters on remote work only when the candidate answered', () => {
    expect(
      JSON.stringify(
        buildOfferRankingQuery(profileOf({ remotePolicy: 'FULL_REMOTE' }))
          .filter,
      ),
    ).toContain('FULL_REMOTE');
    expect(
      JSON.stringify(buildOfferRankingQuery(profileOf()).filter),
    ).not.toContain('remotePolicy');
  });

  /**
   * Someone who asked for hybrid was offering to come in, not requiring it —
   * testing equality hid every fully remote post from them, which on the QA
   * deck cost the candidate the two best-paid offers of her trade.
   */
  it('serves a fully remote post to an hybrid candidate', () => {
    expect(allowedRemotePolicies('HYBRID')).toEqual(['HYBRID', 'FULL_REMOTE']);
  });

  // The inability points one way, so the exclusion does too.
  it('keeps an on-site post away from someone who cannot come in', () => {
    expect(allowedRemotePolicies('FULL_REMOTE')).toEqual(['FULL_REMOTE']);
    expect(allowedRemotePolicies('HYBRID')).not.toContain('ON_SITE');
  });

  // Wanting to be on site is a preference, not a constraint: nothing to filter.
  it('shows everything to a candidate constrained by nothing', () => {
    expect(allowedRemotePolicies('ON_SITE')).toHaveLength(REMOTE_POLICY_COUNT);
    expect(
      JSON.stringify(
        buildOfferRankingQuery(profileOf({ remotePolicy: 'ON_SITE' })).filter,
      ),
    ).not.toContain('remotePolicy');
  });

  // The whole point of the change: a permanent-contract filter amputates the
  // stock of a temping agency for an administrative reason.
  it('no longer filters a CDI candidate down to permanent contracts', () => {
    const { filter } = buildOfferRankingQuery(
      profileOf({ contractTypes: ['CDI'] }),
    );
    const serialised = JSON.stringify(filter);

    expect(serialised).toContain('CDD');
    expect(serialised).toContain('INTERIM');
    expect(serialised).toContain('FREELANCE');
  });

  // The one exception the matrix spells out: a status, not a preference.
  it('keeps internships and apprenticeships out of a CDI deck', () => {
    expect(allowedContractTypes(['CDI'])).not.toContain('STAGE');
    expect(allowedContractTypes(['CDI'])).not.toContain('ALTERNANCE');
    expect(allowedContractTypes(['ALTERNANCE'])).toEqual([
      'ALTERNANCE',
      'STAGE',
    ]);
  });

  // Ticking an extra box must widen the deck, never narrow it.
  it('widens the allowed contracts as the candidate accepts more', () => {
    const one = allowedContractTypes(['CDI']);
    const two = allowedContractTypes(['CDI', 'ALTERNANCE']);

    for (const contract of one) expect(two).toContain(contract);
    expect(two.length).toBeGreaterThan(one.length);
  });

  it('allows everything for a candidate who ticked no contract', () => {
    expect(allowedContractTypes([])).toHaveLength(CONTRACT_TYPE_COUNT);
  });
});

describe('what orders', () => {
  // A dev matching one skill out of five must not score like one matching all
  // five — that is what separates two offers of the same trade.
  it('shares the skills weight across the skills the candidate has', () => {
    const four = weightFor(
      profileOf({ skills: ['React', 'Vue', 'Node', 'SQL'] }),
      (filter) => filter.includes('React'),
    );

    expect(four).toBeCloseTo(CRITERION_WEIGHTS.skills / 4);
  });

  it('never lets the skills axis exceed its weight', () => {
    const skills = Array.from({ length: 12 }, (_, i) => `skill-${i}`);
    const { functions } = buildOfferRankingQuery(profileOf({ skills }));
    const total = (functions as Weighted[])
      .filter((fn) => filterOf(fn).includes('skill-'))
      .reduce((sum, fn) => sum + (fn.weight ?? 0), 0);

    expect(total).toBeCloseTo(CRITERION_WEIGHTS.skills);
  });

  // Fifty skills are allowed on a profile, and each one becomes a clause.
  it('caps how many skills build a clause', () => {
    const skills = Array.from({ length: 50 }, (_, i) => `skill-${i}`);
    const { functions } = buildOfferRankingQuery(profileOf({ skills }));
    const scored = (functions as Weighted[]).filter((fn) =>
      filterOf(fn).includes('skill-'),
    );

    expect(scored).toHaveLength(MAX_SCORED_SKILLS);
  });

  it('ranks a matching seniority above a mismatched one', () => {
    const junior = profileOf({ experienceLevel: 'JUNIOR' });

    const onJunior = weightFor(junior, (f) => f.includes('"JUNIOR"'));
    const onConfirme = weightFor(junior, (f) => f.includes('"CONFIRME"'));
    const onSenior = weightFor(junior, (f) => f.includes('"SENIOR"'));

    expect(onJunior).toBe(CRITERION_WEIGHTS.experience);
    expect(onConfirme).toBeLessThan(onJunior!);
    // A junior on a lead role is a lost application: no clause is emitted at
    // all, so the offer simply earns nothing here.
    expect(onSenior).toBeUndefined();
  });

  it('scores nothing on seniority for a candidate who did not say', () => {
    expect(
      JSON.stringify(buildOfferRankingQuery(profileOf()).functions),
    ).not.toContain('minExperienceLevel');
  });

  // Asymmetry is the point: someone who takes a mission also takes a permanent
  // contract, and not the other way round.
  it('ranks a permanent contract high for a temping candidate', () => {
    const interim = profileOf({ contractTypes: ['INTERIM'] });

    expect(weightFor(interim, (f) => f.includes('CDI'))).toBe(
      CRITERION_WEIGHTS.contractType,
    );
    expect(
      weightFor(profileOf({ contractTypes: ['CDI'] }), (f) =>
        f.includes('INTERIM'),
      ),
    ).toBeLessThan(CRITERION_WEIGHTS.contractType);
  });

  it('takes the best row when the candidate accepts several contracts', () => {
    const both = profileOf({ contractTypes: ['CDI', 'CDD'] });

    // CDI→CDD is 2 and CDD→CDD is 3: accepting CDD as well must not cost the
    // candidate the better of the two readings.
    expect(weightFor(both, (f) => f.includes('CDD'))).toBe(
      CRITERION_WEIGHTS.contractType,
    );
  });

  // An offer at 32–45 k€ used to score exactly like one at 45–60 k€.
  it('measures how far up the expectation the salary reaches', () => {
    const { functions } = buildOfferRankingQuery(
      profileOf({ salaryMin: 45000, salaryMax: 60000 }),
    );
    const script = JSON.stringify(functions);

    expect(script).toContain('script_score');
    expect(script).toContain('45000');
    expect(script).toContain('60000');
    // Measured on the top of the offer's range, never on the overlap: paying
    // above the expectation must not rank below paying exactly at it.
    expect(script).toContain('offerTop');
  });

  it('scores no salary for a candidate who gave no expectation', () => {
    expect(
      JSON.stringify(buildOfferRankingQuery(profileOf()).functions),
    ).not.toContain('script_score');
  });

  // Nobody commutes 86 km a day because the post pays well — but 31 km is not
  // worthless to someone who said 30, so it decays instead of switching off.
  it('decays the location rather than cutting at the radius', () => {
    const { functions } = buildOfferRankingQuery(
      profileOf({ latitude: 45.75, longitude: 4.85, mobilityRadiusKm: 30 }),
    );
    const serialised = JSON.stringify(functions);

    expect(serialised).toContain('gauss');
    expect(serialised).toContain('30km');
    expect(serialised).not.toContain('geo_distance');
  });

  it('drops the location axis for a candidate open to the whole country', () => {
    const { functions } = buildOfferRankingQuery(
      profileOf({
        latitude: 45.75,
        longitude: 4.85,
        mobilityNationwide: true,
      }),
    );

    expect(JSON.stringify(functions)).not.toContain('location');
  });

  // A three-month-old post is often already filled, and it used to only break
  // ties rather than cost anything.
  it('always scores freshness', () => {
    expect(
      JSON.stringify(buildOfferRankingQuery(profileOf()).functions),
    ).toContain('createdAt');
  });
});

describe('the scale', () => {
  // Nothing may quietly outweigh the criteria around it.
  it('keeps every axis within its declared weight', () => {
    const complete = profileOf({
      jobFamilyIds: [13],
      skills: ['React', 'Vue'],
      contractTypes: ['CDI'],
      experienceLevel: 'CONFIRME',
      remotePolicy: 'HYBRID',
      salaryMin: 45000,
      salaryMax: 60000,
      latitude: 45.75,
      longitude: 4.85,
      mobilityRadiusKm: 30,
    });
    const { functions } = buildOfferRankingQuery(complete);

    for (const fn of functions as Weighted[]) {
      expect(fn.weight ?? 0).toBeLessThanOrEqual(
        Math.max(...Object.values(CRITERION_WEIGHTS)),
      );
    }
  });

  // An axis never subtracts: a candidate cannot end up behind by answering.
  it('emits no negative weight', () => {
    expect(
      totalWeight(
        profileOf({
          skills: ['React'],
          contractTypes: ['STAGE'],
          experienceLevel: 'EXPERT',
        }),
      ),
    ).toBeGreaterThan(0);
  });
});
