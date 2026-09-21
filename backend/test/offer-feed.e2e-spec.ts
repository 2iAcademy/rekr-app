import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import {
  ContractType,
  ExperienceLevel,
  OfferStatus,
  RemotePolicy,
} from '../generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup-app';
import { bearerFor } from './auth-header';
import { httpRequest } from './http-client';
import { resetDb } from './reset-db';
import { resetThrottler } from './throttler-reset';
import { stubCityReference } from './city-reference';
import {
  DEFAULT_JOB_FAMILY,
  OTHER_JOB_FAMILY,
  jobFamilyIdFor,
} from './job-family-reference';

type FeedItem = {
  id: number;
  title: string;
  description: string | null;
  city: string | null;
  contractType: ContractType | null;
  minExperienceLevel: ExperienceLevel | null;
  remotePolicy: RemotePolicy | null;
  salaryMin: number | null;
  salaryMax: number | null;
  createdAt: string;
  company: { id: number; name: string; logo: string | null };
  tags: string[];
};

type OfferOverrides = {
  title?: string;
  description?: string | null;
  status?: OfferStatus;
  city?: string | null;
  contractType?: ContractType | null;
  minExperienceLevel?: ExperienceLevel | null;
  remotePolicy?: RemotePolicy | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  createdAt?: Date;
  jobFamilyId?: number | null;
};

const VITRINE_KEYS = [
  'city',
  'company',
  'contractType',
  'createdAt',
  'description',
  'id',
  'minExperienceLevel',
  'remotePolicy',
  'salaryMax',
  'salaryMin',
  'tags',
  'title',
];

describe('Offer feed (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let candidate: { id: number; email: string };
  let recruiter: { id: number; email: string };
  let company: { id: number };

  const feedOf = (res: request.Response): FeedItem[] => res.body as FeedItem[];

  const idsOf = (res: request.Response): number[] =>
    feedOf(res).map((offer) => offer.id);

  const createUser = (userType: 'candidate' | 'recruiter') =>
    prisma.user.create({
      data: {
        email: [userType, Date.now(), Math.random()].join('-') + '@test.dev',
        passwordHash: 'x',
        userType,
      },
    });

  const seedRecruiterWithCompany = async (name: string) => {
    const user = await createUser('recruiter');
    const created = await prisma.company.create({
      data: { name, logo: 'companies/1/logo/acme.webp' },
    });
    await prisma.recruiterProfile.create({
      data: {
        userId: user.id,
        companyId: created.id,
        firstName: 'R',
        lastName: 'D',
      },
    });
    return { user, company: created };
  };

  const seedOffer = (overrides: OfferOverrides = {}) =>
    prisma.offer.create({
      data: {
        title: 'Développeur Front',
        description: 'Belle mission.',
        status: 'open',
        city: 'Lyon',
        contractType: 'CDI',
        minExperienceLevel: 'CONFIRME',
        remotePolicy: 'HYBRID',
        salaryMin: 45000,
        salaryMax: 60000,
        companyId: company.id,
        createdById: recruiter.id,
        ...overrides,
      },
    });

  const getFeed = (query = '') =>
    httpRequest(app)
      .get(`/api/offers/feed${query}`)
      .set('Authorization', bearerFor(app, candidate.id, 'candidate'));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(prisma);
    resetThrottler(app);
    stubCityReference();

    candidate = await createUser('candidate');
    const seeded = await seedRecruiterWithCompany('Acme');
    recruiter = seeded.user;
    company = seeded.company;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('access', () => {
    it('rejects an unauthenticated read with 401', async () => {
      await seedOffer();

      await httpRequest(app).get('/api/offers/feed').expect(401);
    });

    it('forbids a recruiter from reading the offer feed (403)', async () => {
      await seedOffer();

      await httpRequest(app)
        .get('/api/offers/feed')
        .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
        .expect(403);
    });

    it('returns an array to a candidate', async () => {
      await seedOffer();

      const res = await getFeed().expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
    });

    // The trap this path introduces: `feed` sits under the same prefix as
    // `@Get(':id')`, so declaring it after that route would hand « feed » to
    // the ParseIntPipe and answer 400. The declaration order in the controller
    // is load-bearing, and this is what holds it.
    it('does not let the :id route swallow /feed', async () => {
      await seedOffer();

      const res = await getFeed();

      expect(res.status).not.toBe(400);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    // `feed` is a literal segment sitting under the same prefix as the `:id`
    // detail route; both have to stay reachable side by side.
    it('leaves the detail route reachable next to the feed', async () => {
      const offer = await seedOffer();

      const res = await httpRequest(app)
        .get(`/api/offers/${offer.id}`)
        .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
        .expect(200);

      expect((res.body as { id: number }).id).toBe(offer.id);
    });
  });

  /**
   * The deck is shaped by the profile, not by a filter bar.
   *
   * Read server-side from the caller's own profile rather than passed as query
   * parameters: the preferences are already stored, so making the client resend
   * them would give the same fact two sources — and let anyone widen their own
   * deck past what they told the product they were looking for.
   */
  describe('shaped by the candidate profile', () => {
    const seedProfile = (overrides: Record<string, unknown> = {}) =>
      prisma.candidateProfile.create({
        data: {
          userId: candidate.id,
          firstName: 'Ada',
          lastName: 'Lovelace',
          ...overrides,
        },
      });

    const titlesOf = (res: request.Response): string[] =>
      (res.body as { title: string }[]).map((offer) => offer.title);

    /**
     * The contract orders, it no longer eliminates.
     *
     * Filtering on it amputates half the stock of a temping agency and hides
     * the best offer of the catalogue for an administrative reason — someone
     * who asked for a permanent contract still wants to see the six-month
     * mission that pays well, further down the deck.
     */
    it('no longer hides a contract the candidate did not tick', async () => {
      await seedProfile({ contractTypes: ['CDI'] });
      await seedOffer({ title: 'CDI', contractType: 'CDI' });
      await seedOffer({ title: 'Intérim', contractType: 'INTERIM' });

      const res = await getFeed().expect(200);

      expect(titlesOf(res).sort()).toEqual(['CDI', 'Intérim']);
    });

    /**
     * The single exception, and the only one the matrix marks as impossible:
     * an apprenticeship or an internship is a status, not a preference. The
     * exclusion cuts both ways, so neither side is served the other.
     */
    it('keeps a study contract out of a permanent-contract deck', async () => {
      await seedProfile({ contractTypes: ['CDI'] });
      await seedOffer({ title: 'CDI', contractType: 'CDI' });
      await seedOffer({ title: 'Alternance', contractType: 'ALTERNANCE' });
      await seedOffer({ title: 'Stage', contractType: 'STAGE' });

      const res = await getFeed().expect(200);

      expect(titlesOf(res)).toEqual(['CDI']);
    });

    it('keeps a permanent contract out of an apprenticeship deck', async () => {
      await seedProfile({ contractTypes: ['ALTERNANCE'] });
      await seedOffer({ title: 'Alternance', contractType: 'ALTERNANCE' });
      await seedOffer({ title: 'Stage', contractType: 'STAGE' });
      await seedOffer({ title: 'CDI', contractType: 'CDI' });

      const res = await getFeed().expect(200);

      expect(titlesOf(res).sort()).toEqual(['Alternance', 'Stage']);
    });

    // Ticking one more box must widen the deck, never narrow it.
    it('widens the deck as the candidate accepts more contracts', async () => {
      await seedProfile({ contractTypes: ['ALTERNANCE', 'CDI'] });
      await seedOffer({ title: 'Alternance', contractType: 'ALTERNANCE' });
      await seedOffer({ title: 'CDI', contractType: 'CDI' });
      await seedOffer({ title: 'Stage', contractType: 'STAGE' });

      const res = await getFeed().expect(200);

      expect(titlesOf(res).sort()).toEqual(['Alternance', 'CDI', 'Stage']);
    });

    /**
     * Remote work filters on what the candidate can hold, not on a literal
     * match. Someone who asked for hybrid was offering to come in, not
     * requiring it, so a fully remote post suits them too — testing equality
     * hid the best-paid offers of their trade from them.
     *
     * The inability only points one way, which is why this matrix, unlike the
     * contract one, is not symmetric.
     */
    it('serves a fully remote post to an hybrid candidate', async () => {
      await seedProfile({ remotePolicy: 'HYBRID' });
      await seedOffer({ title: 'Hybride', remotePolicy: 'HYBRID' });
      await seedOffer({ title: 'Full remote', remotePolicy: 'FULL_REMOTE' });
      await seedOffer({ title: 'Sur site', remotePolicy: 'ON_SITE' });

      const res = await getFeed().expect(200);

      expect(titlesOf(res).sort()).toEqual(['Full remote', 'Hybride']);
    });

    // Wanting to be on site constrains nothing: the whole deck stays open.
    it('hides nothing from a candidate who asked to be on site', async () => {
      await seedProfile({ remotePolicy: 'ON_SITE' });
      await seedOffer({ title: 'Sur site', remotePolicy: 'ON_SITE' });
      await seedOffer({ title: 'Hybride', remotePolicy: 'HYBRID' });
      await seedOffer({ title: 'Full remote', remotePolicy: 'FULL_REMOTE' });

      const res = await getFeed().expect(200);

      expect(titlesOf(res).sort()).toEqual([
        'Full remote',
        'Hybride',
        'Sur site',
      ]);
    });

    it('keeps an on-site post away from someone who cannot come in', async () => {
      await seedProfile({ remotePolicy: 'FULL_REMOTE' });
      await seedOffer({ title: 'Remote', remotePolicy: 'FULL_REMOTE' });
      await seedOffer({ title: 'Hybride', remotePolicy: 'HYBRID' });
      await seedOffer({ title: 'Sur site', remotePolicy: 'ON_SITE' });

      const res = await getFeed().expect(200);

      expect(titlesOf(res)).toEqual(['Remote']);
    });

    // An unset preference is not a preference for nothing: the candidate simply
    // did not say, so the deck stays wide rather than emptying itself.
    it('narrows nothing on a preference the candidate left unset', async () => {
      await seedProfile({ contractTypes: [] });
      await seedOffer({ title: 'Alternance', contractType: 'ALTERNANCE' });
      await seedOffer({ title: 'CDI', contractType: 'CDI' });

      const res = await getFeed().expect(200);

      expect(titlesOf(res).sort()).toEqual(['Alternance', 'CDI']);
    });

    // Signup writes the user, the wizard writes the profile: between the two,
    // there is nothing to narrow the deck with.
    it('serves the whole deck to a candidate who has no profile yet', async () => {
      await seedOffer({ title: 'Alternance', contractType: 'ALTERNANCE' });
      await seedOffer({ title: 'CDI', contractType: 'CDI' });

      const res = await getFeed().expect(200);

      expect(titlesOf(res).sort()).toEqual(['Alternance', 'CDI']);
    });

    // An offer that never said is not an offer that says no: dropping it would
    // hide posts from every candidate who did fill the preference in.
    it('keeps an offer whose own field is unset', async () => {
      await seedProfile({ contractTypes: ['CDI'] });
      await seedOffer({ title: 'Non précisé', contractType: null });

      const res = await getFeed().expect(200);

      expect(titlesOf(res)).toEqual(['Non précisé']);
    });
  });

  /**
   * The trade excludes, where every other preference only narrows.
   *
   * A contract type left unset widens the deck; a trade left unset on the
   * offer side removes it as soon as the candidate named one. Worth holding in
   * e2e rather than in the service alone: the rule is expressed as a Prisma
   * `where`, and what the unit tests assert is the object handed to the query,
   * not what the query then returns.
   */
  describe('shaped by the trade', () => {
    let wanted: number;
    let unwanted: number;

    const seedProfile = () =>
      prisma.candidateProfile.create({
        data: { userId: candidate.id, firstName: 'Ada', lastName: 'Lovelace' },
      });

    const looksFor = (...jobFamilyIds: number[]) =>
      prisma.candidateJobFamily.createMany({
        data: jobFamilyIds.map((jobFamilyId) => ({
          candidateUserId: candidate.id,
          jobFamilyId,
        })),
      });

    const titlesOf = (res: request.Response): string[] =>
      (res.body as { title: string }[]).map((offer) => offer.title);

    beforeAll(async () => {
      wanted = await jobFamilyIdFor(prisma, DEFAULT_JOB_FAMILY);
      unwanted = await jobFamilyIdFor(prisma, OTHER_JOB_FAMILY);
    });

    it('keeps only the trade the candidate named', async () => {
      await seedProfile();
      await looksFor(wanted);
      await seedOffer({ title: 'Dev', jobFamilyId: wanted });
      await seedOffer({ title: 'Boulanger', jobFamilyId: unwanted });

      const res = await getFeed().expect(200);

      expect(titlesOf(res)).toEqual(['Dev']);
    });

    it('keeps every trade the candidate named', async () => {
      await seedProfile();
      await looksFor(wanted, unwanted);
      await seedOffer({ title: 'Dev', jobFamilyId: wanted });
      await seedOffer({ title: 'Boulanger', jobFamilyId: unwanted });

      const res = await getFeed().expect(200);

      expect(titlesOf(res).sort()).toEqual(['Boulanger', 'Dev']);
    });

    // Nobody changes career because an unrelated post pays well: a trade that
    // does not match is dropped even when every other axis lines up.
    it('drops an unwanted trade whose every other axis matches', async () => {
      await prisma.candidateProfile.create({
        data: {
          userId: candidate.id,
          firstName: 'Ada',
          lastName: 'Lovelace',
          contractTypes: ['CDI'],
          remotePolicy: 'HYBRID',
        },
      });
      await looksFor(wanted);
      await seedOffer({
        title: 'Boulanger',
        jobFamilyId: unwanted,
        contractType: 'CDI',
        remotePolicy: 'HYBRID',
      });

      const res = await getFeed().expect(200);

      expect(titlesOf(res)).toEqual([]);
    });

    /**
     * The mirror of the test above, and the one that would catch the `OR` that
     * `findFeed` warns about: collected in an `AND`, a trade the candidate did
     * not name cannot be readmitted by a contract type that happens to match.
     */
    it('does not let a matching contract type readmit an unwanted trade', async () => {
      await prisma.candidateProfile.create({
        data: {
          userId: candidate.id,
          firstName: 'Ada',
          lastName: 'Lovelace',
          contractTypes: ['CDI'],
        },
      });
      await looksFor(wanted);
      await seedOffer({
        title: 'Dev alternance',
        jobFamilyId: wanted,
        contractType: 'ALTERNANCE',
      });
      await seedOffer({
        title: 'Boulanger CDI',
        jobFamilyId: unwanted,
        contractType: 'CDI',
      });

      const res = await getFeed().expect(200);

      expect(titlesOf(res)).toEqual([]);
    });

    // The column is nullable, so the accounts created before it exists must not
    // face an empty deck — including the offers that carry no trade either.
    it('serves every trade to a candidate who named none', async () => {
      await seedProfile();
      await seedOffer({ title: 'Dev', jobFamilyId: wanted });
      await seedOffer({ title: 'Boulanger', jobFamilyId: unwanted });
      await seedOffer({ title: 'Sans métier', jobFamilyId: null });

      const res = await getFeed().expect(200);

      expect(titlesOf(res).sort()).toEqual(['Boulanger', 'Dev', 'Sans métier']);
    });

    it('serves every trade to a candidate who has no profile at all', async () => {
      await seedOffer({ title: 'Dev', jobFamilyId: wanted });
      await seedOffer({ title: 'Boulanger', jobFamilyId: unwanted });

      const res = await getFeed().expect(200);

      expect(titlesOf(res).sort()).toEqual(['Boulanger', 'Dev']);
    });

    /**
     * Unlike every other axis, an offer that never said is treated as a no.
     *
     * A contract type left unset on the offer keeps it in the deck; an unset
     * trade does not, because it is unknown rather than universal — serving it
     * to someone who named a trade would reopen the very bucket the column was
     * added to close.
     */
    it('drops an offer carrying no trade once the candidate named one', async () => {
      await seedProfile();
      await looksFor(wanted);
      await seedOffer({ title: 'Dev', jobFamilyId: wanted });
      await seedOffer({ title: 'Sans métier', jobFamilyId: null });

      const res = await getFeed().expect(200);

      expect(titlesOf(res)).toEqual(['Dev']);
    });
  });

  describe('payload', () => {
    it('exposes the showcase fields and nothing else', async () => {
      const offer = await seedOffer();
      const tag = await prisma.tag.create({
        data: { label: 'React', category: 'skill' },
      });
      await prisma.offerTag.create({
        data: { offerId: offer.id, tagId: tag.id },
      });

      const res = await getFeed().expect(200);
      const [item] = feedOf(res);

      expect(Object.keys(item).sort()).toEqual(VITRINE_KEYS);
      expect(Object.keys(item.company).sort()).toEqual(['id', 'logo', 'name']);
      expect(item).toMatchObject({
        id: offer.id,
        title: 'Développeur Front',
        description: 'Belle mission.',
        city: 'Lyon',
        contractType: 'CDI',
        minExperienceLevel: 'CONFIRME',
        remotePolicy: 'HYBRID',
        salaryMin: 45000,
        salaryMax: 60000,
        company: { id: company.id, name: 'Acme' },
        tags: ['React'],
      });
    });

    /**
     * `offer_tag` carries the skills AND the benefits of an offer, told apart
     * by the category of the tag. `tags` advertises the skills alone, so the
     * read has to filter on the category rather than assume the pivot only
     * ever holds one kind — which stopped being true when the benefits moved
     * from the company onto the offer.
     */
    it('advertises the skills alone, never the benefits', async () => {
      const offer = await seedOffer();
      const link = async (label: string, category: 'skill' | 'benefit') => {
        const tag = await prisma.tag.create({ data: { label, category } });
        await prisma.offerTag.create({
          data: { offerId: offer.id, tagId: tag.id },
        });
      };
      await link('React', 'skill');
      await link('Mutuelle', 'benefit');

      const res = await getFeed().expect(200);
      const [item] = feedOf(res);

      expect(item.tags).toEqual(['React']);
    });

    it('leaks no account data, internal key or geolocation', async () => {
      await seedOffer();

      const res = await getFeed().expect(200);
      const [item] = feedOf(res);

      expect(item).not.toHaveProperty('createdById');
      expect(item).not.toHaveProperty('companyId');
      expect(item).not.toHaveProperty('postalCode');
      expect(item).not.toHaveProperty('latitude');
      expect(item).not.toHaveProperty('longitude');
      expect(item).not.toHaveProperty('status');
      expect(item).not.toHaveProperty('updatedAt');
      expect(JSON.stringify(res.body)).not.toContain(recruiter.email);
    });
  });

  describe('selection', () => {
    it('keeps open offers only', async () => {
      const open = await seedOffer({ status: 'open' });
      await seedOffer({ status: 'draft' });
      await seedOffer({ status: 'paused' });
      await seedOffer({ status: 'filled' });
      await seedOffer({ status: 'closed' });

      const res = await getFeed().expect(200);

      expect(idsOf(res)).toEqual([open.id]);
    });

    it('hides an offer the candidate already liked', async () => {
      const liked = await seedOffer();
      const untouched = await seedOffer();
      await prisma.candidateLikesOffer.create({
        data: { candidateUserId: candidate.id, offerId: liked.id },
      });

      const res = await getFeed().expect(200);

      expect(idsOf(res)).toEqual([untouched.id]);
    });

    it('hides an offer the candidate already passed', async () => {
      const passed = await seedOffer();
      const untouched = await seedOffer();
      await prisma.candidatePassesOffer.create({
        data: { candidateUserId: candidate.id, offerId: passed.id },
      });

      const res = await getFeed().expect(200);

      expect(idsOf(res)).toEqual([untouched.id]);
    });

    /**
     * Answering through the routes, not by writing the pivots: an answer now
     * clears the other one, so the deck must still hide the offer once the
     * row that hid it has been replaced by the other.
     */
    it('hides an offer answered through the routes, whichever answer came last', async () => {
      const likedThenPassed = await seedOffer();
      const passedThenLiked = await seedOffer();
      const untouched = await seedOffer();
      const token = bearerFor(app, candidate.id, 'candidate');
      const answer = (offerId: number, verb: 'like' | 'pass') =>
        httpRequest(app)
          .post(`/api/offers/${offerId}/${verb}`)
          .set('Authorization', token)
          .expect(201);

      await answer(likedThenPassed.id, 'like');
      await answer(likedThenPassed.id, 'pass');
      await answer(passedThenLiked.id, 'pass');
      await answer(passedThenLiked.id, 'like');

      const res = await getFeed().expect(200);

      expect(idsOf(res)).toEqual([untouched.id]);
    });

    /** Withdrawing a like puts the offer back in the deck: nothing answers it. */
    it('serves again an offer whose like was withdrawn', async () => {
      const offer = await seedOffer();
      const token = bearerFor(app, candidate.id, 'candidate');

      await httpRequest(app)
        .post(`/api/offers/${offer.id}/like`)
        .set('Authorization', token)
        .expect(201);
      await httpRequest(app)
        .delete(`/api/offers/${offer.id}/like`)
        .set('Authorization', token)
        .expect(204);

      const res = await getFeed().expect(200);

      expect(idsOf(res)).toEqual([offer.id]);
    });

    it('keeps an offer another candidate liked or passed', async () => {
      const offer = await seedOffer();
      const other = await createUser('candidate');
      await prisma.candidateLikesOffer.create({
        data: { candidateUserId: other.id, offerId: offer.id },
      });
      await prisma.candidatePassesOffer.create({
        data: { candidateUserId: other.id, offerId: offer.id },
      });

      const res = await getFeed().expect(200);

      expect(idsOf(res)).toEqual([offer.id]);
    });
  });

  /**
   * The deck no longer takes filters. The two axes it used to accept — contract
   * type and remote policy — are read from the candidate's profile instead
   * (`shaped by the candidate profile` above), and keeping the query parameters
   * would advertise a second way to say the same thing, with a different
   * meaning: a query filter drops the offers whose column is null where a
   * preference keeps them.
   */
  describe('the retired query filters', () => {
    it.each([
      'contractType=CDI',
      'experienceLevel=JUNIOR',
      'remotePolicy=HYBRID',
      'city=Lyon',
    ])('refuses %s as an unknown parameter (400)', async (query) => {
      await seedOffer();

      await getFeed(`?${query}`).expect(400);
    });
  });

  describe('deck order', () => {
    it('orders by creation date then id, both descending', async () => {
      const oldest = await seedOffer({ createdAt: new Date('2026-01-01') });
      const first = await seedOffer({ createdAt: new Date('2026-02-01') });
      const second = await seedOffer({ createdAt: new Date('2026-02-01') });

      const res = await getFeed().expect(200);

      expect(idsOf(res)).toEqual([
        Math.max(first.id, second.id),
        Math.min(first.id, second.id),
        oldest.id,
      ]);
    });

    // A card answered leaves the deck, so the next read is the rest of it. An
    // offset computed over a set the swipe shrinks jumps over a card: page 1,
    // one pass, page 2 never showed the one in the middle. The deck therefore
    // takes no offset at all.
    it('walks the whole deck one swipe at a time, skipping none', async () => {
      const third = await seedOffer({ createdAt: new Date('2026-01-01') });
      const second = await seedOffer({ createdAt: new Date('2026-02-01') });
      const first = await seedOffer({ createdAt: new Date('2026-03-01') });

      const swiped: number[] = [];
      for (let card = 0; card < 3; card++) {
        const [id] = idsOf(await getFeed('?limit=1').expect(200));
        swiped.push(id);
        await prisma.candidatePassesOffer.create({
          data: { candidateUserId: candidate.id, offerId: id },
        });
      }

      expect(swiped).toEqual([first.id, second.id, third.id]);
      expect(idsOf(await getFeed('?limit=1').expect(200))).toEqual([]);
      await getFeed('?page=2&limit=1').expect(400);
    });
  });

  describe('query validation', () => {
    it('rejects a limit above 100', async () => {
      await getFeed('?limit=101').expect(400);
    });

    it('rejects a filter value outside its enum', async () => {
      await getFeed('?contractType=CDX').expect(400);
    });

    it('rejects an unknown query parameter', async () => {
      await getFeed('?foo=bar').expect(400);
    });
  });
});
