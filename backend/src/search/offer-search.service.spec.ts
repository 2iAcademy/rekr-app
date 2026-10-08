import { Logger } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { OfferSearchService } from './offer-search.service';
import { CRITERION_WEIGHTS } from './ranking/ranking-rules';

jest.mock('@elastic/elasticsearch', () => ({ Client: jest.fn() }));

const mockedClient = Client as jest.MockedClass<typeof Client>;

/** Lets the background recovery started by `onModuleInit` run to its end. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('OfferSearchService', () => {
  const elastic = {
    indices: { exists: jest.fn(), create: jest.fn(), delete: jest.fn() },
    search: jest.fn(),
    index: jest.fn(),
    delete: jest.fn(),
    close: jest.fn(),
  };
  const prisma = {
    offer: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
  };
  const originalEnvironment = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnvironment,
      ELASTICSEARCH_NODE: 'http://search.test:9200',
    };
    mockedClient.mockImplementation(() => elastic as unknown as Client);
  });

  it('bounds Elasticsearch requests and retry attempts', () => {
    new OfferSearchService(prisma as never);

    expect(mockedClient).toHaveBeenCalledWith({
      node: 'http://search.test:9200',
      requestTimeout: 2000,
      maxRetries: 1,
    });
  });

  it('authenticates with the API key when one is configured', () => {
    process.env.ELASTICSEARCH_API_KEY = ' encoded-key ';

    new OfferSearchService(prisma as never);

    expect(mockedClient).toHaveBeenCalledWith({
      node: 'http://search.test:9200',
      requestTimeout: 2000,
      maxRetries: 1,
      auth: { apiKey: 'encoded-key' },
    });
  });

  it('sends no credentials when the API key is blank', () => {
    process.env.ELASTICSEARCH_API_KEY = '  ';

    new OfferSearchService(prisma as never);

    expect(mockedClient.mock.calls[0][0]).not.toHaveProperty('auth');
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it('sends the built ranking query and returns ranked offer ids only', async () => {
    elastic.search.mockResolvedValue({
      hits: {
        hits: [
          { _id: '12', _source: { id: 12 } },
          { _id: '9', _source: { id: 9 } },
        ],
      },
    });
    const service = new OfferSearchService(prisma as never);

    await expect(
      service.rankOfferIds(
        {
          jobFamilyIds: [13],
          primaryJobFamilyId: null,
          skills: ['TypeScript'],
          contractTypes: ['CDI'],
          experienceLevel: 'CONFIRME',
          remotePolicy: 'HYBRID',
          salaryMin: 45000,
          salaryMax: 60000,
          latitude: 45.75,
          longitude: 4.85,
          mobilityRadiusKm: 30,
          mobilityNationwide: false,
        },
        20,
      ),
    ).resolves.toEqual([12, 9]);

    type SearchRequest = {
      size: number;
      query: {
        function_score: {
          query: { bool: { filter: unknown[] } };
          functions: { weight?: number }[];
          score_mode: string;
          boost_mode: string;
        };
      };
    };
    const calls = elastic.search.mock.calls as unknown as SearchRequest[][];
    const request = calls[0]?.[0];
    const { function_score: scoring } = request.query;

    expect(request.size).toBe(60);
    // The trade filters, so it belongs to the query rather than the functions.
    expect(scoring.query.bool.filter).toEqual(
      expect.arrayContaining([{ terms: { jobFamilyId: [13] } }]),
    );
    // Summed onto a base of zero: the score is the points earned, never a
    // relevance figure Elasticsearch computed by itself.
    expect(scoring.score_mode).toBe('sum');
    expect(scoring.boost_mode).toBe('replace');
    // A single skill can no longer collect the whole skills weight.
    const skillWeights = scoring.functions
      .map(({ weight }) => weight)
      .filter((weight): weight is number => weight !== undefined);
    expect(Math.max(...skillWeights)).toBeLessThanOrEqual(
      CRITERION_WEIGHTS.skills,
    );
  });

  it('does not use Elasticsearch when explicitly disabled', async () => {
    process.env.ELASTICSEARCH_ENABLED = 'false';
    const service = new OfferSearchService(prisma as never);

    await expect(
      service.rankOfferIds(
        {
          jobFamilyIds: [],
          primaryJobFamilyId: null,
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
        },
        20,
      ),
    ).resolves.toBeNull();
    expect(elastic.search).not.toHaveBeenCalled();
  });

  it('falls back to PostgreSQL ordering when Elasticsearch search fails', async () => {
    elastic.search.mockRejectedValue(new Error('cluster unavailable'));
    const service = new OfferSearchService(prisma as never);

    await expect(
      service.rankOfferIds(
        {
          jobFamilyIds: [],
          primaryJobFamilyId: null,
          skills: ['React'],
          contractTypes: ['CDI'],
          experienceLevel: null,
          remotePolicy: 'HYBRID',
          salaryMin: null,
          salaryMax: null,
          latitude: null,
          longitude: null,
          mobilityRadiusKm: null,
          mobilityNationwide: true,
        },
        20,
      ),
    ).resolves.toBeNull();
  });

  it('rebuilds the index from open offers when explicitly requested', async () => {
    process.env.ELASTICSEARCH_REINDEX_ON_STARTUP = 'true';
    elastic.indices.exists.mockResolvedValue(true);
    const service = new OfferSearchService(prisma as never);

    service.onModuleInit();
    await settle();

    expect(elastic.indices.delete).toHaveBeenCalledWith({
      index: 'rekr-offers-v2',
    });
    type CreateIndexRequest = {
      index: string;
      settings: { number_of_replicas: number };
      mappings: { properties: Record<string, unknown> };
    };
    const createCalls = elastic.indices.create.mock
      .calls as unknown as CreateIndexRequest[][];
    const createRequest = createCalls[0]?.[0];
    expect(createRequest.index).toBe('rekr-offers-v2');
    expect(createRequest.settings).toEqual({ number_of_replicas: 0 });
    expect(createRequest.mappings.properties.location).toEqual({
      type: 'geo_point',
    });
    expect(createRequest.mappings.properties.skills).toEqual({
      type: 'keyword',
    });
    // Both axes added to the ranking have to be on the document, or they can
    // never be scored: the trade filters and the seniority weighs.
    expect(createRequest.mappings.properties.jobFamilyId).toEqual({
      type: 'integer',
    });
    expect(createRequest.mappings.properties.minExperienceLevel).toEqual({
      type: 'keyword',
    });
    expect(prisma.offer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'open' } }),
    );
  });

  it('removes a closed or deleted offer from the derived index', async () => {
    elastic.delete.mockResolvedValue({});
    prisma.offer.findUnique.mockResolvedValue({
      id: 42,
      status: 'closed',
    });
    const service = new OfferSearchService(prisma as never);

    await service.syncOffer(42);

    expect(elastic.delete).toHaveBeenCalledWith(
      { index: 'rekr-offers-v2', id: '42' },
      { ignore: [404] },
    );
    expect(elastic.index).not.toHaveBeenCalled();
  });

  describe('availability', () => {
    it('is disabled when Elasticsearch is switched off', async () => {
      process.env.ELASTICSEARCH_ENABLED = 'false';
      const service = new OfferSearchService(prisma as never);

      await expect(service.availability()).resolves.toBe('disabled');
      expect(elastic.indices.exists).not.toHaveBeenCalled();
    });

    it('is available when the offers index exists', async () => {
      elastic.indices.exists.mockResolvedValue(true);
      const service = new OfferSearchService(prisma as never);

      await expect(service.availability()).resolves.toBe('available');
      expect(elastic.indices.exists).toHaveBeenCalledWith(
        { index: 'rekr-offers-v2' },
        { requestTimeout: 2000, maxRetries: 0 },
      );
    });

    it('is unavailable when the offers index is missing', async () => {
      elastic.indices.exists.mockResolvedValue(false);
      const service = new OfferSearchService(prisma as never);

      await expect(service.availability()).resolves.toBe('unavailable');
    });

    it('is unavailable when Elasticsearch does not answer', async () => {
      elastic.indices.exists.mockRejectedValue(
        new Error('connect ECONNREFUSED'),
      );
      const service = new OfferSearchService(prisma as never);

      await expect(service.availability()).resolves.toBe('unavailable');
    });
  });

  describe('startup recovery', () => {
    const connectionRefused = new Error('connect ECONNREFUSED');

    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['setImmediate'] });
      elastic.indices.exists.mockReset();
      elastic.search.mockReset().mockResolvedValue({ hits: { hits: [] } });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('does not wait for Elasticsearch before the backend is up', () => {
      elastic.indices.exists.mockReturnValue(new Promise(() => undefined));
      const service = new OfferSearchService(prisma as never);

      expect(service.onModuleInit()).toBeUndefined();
    });

    it('creates the index once Elasticsearch answers after a failed start', async () => {
      elastic.indices.exists
        .mockRejectedValueOnce(connectionRefused)
        .mockResolvedValue(false);
      const service = new OfferSearchService(prisma as never);

      service.onModuleInit();
      await settle();
      expect(elastic.indices.create).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(5_000);
      await settle();

      expect(elastic.indices.create).toHaveBeenCalledTimes(1);
      expect(prisma.offer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'open' } }),
      );
      expect(jest.getTimerCount()).toBe(0);
    });

    it('spaces the attempts out, up to five minutes', async () => {
      elastic.indices.exists.mockRejectedValue(connectionRefused);
      const service = new OfferSearchService(prisma as never);

      service.onModuleInit();
      await settle();
      for (const delayMs of [5_000, 10_000, 20_000, 40_000, 80_000, 160_000]) {
        await jest.advanceTimersByTimeAsync(delayMs);
        await settle();
      }
      const attemptsBefore = elastic.indices.exists.mock.calls.length;

      await jest.advanceTimersByTimeAsync(299_999);
      await settle();
      expect(elastic.indices.exists).toHaveBeenCalledTimes(attemptsBefore);

      await jest.advanceTimersByTimeAsync(1);
      await settle();
      expect(elastic.indices.exists).toHaveBeenCalledTimes(attemptsBefore + 1);
    });

    it('stops retrying once the module is destroyed', async () => {
      elastic.indices.exists.mockRejectedValue(connectionRefused);
      const service = new OfferSearchService(prisma as never);

      service.onModuleInit();
      await settle();
      await service.onModuleDestroy();

      expect(jest.getTimerCount()).toBe(0);
    });

    it('never tries when Elasticsearch is switched off', async () => {
      process.env.ELASTICSEARCH_ENABLED = 'false';
      const service = new OfferSearchService(prisma as never);

      service.onModuleInit();
      await settle();

      expect(elastic.indices.exists).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('catch-up after an outage', () => {
    const connectionRefused = new Error('connect ECONNREFUSED');
    const openOffer = (id: number) => ({
      id,
      status: 'open',
      jobFamilyId: null,
      contractType: 'CDI',
      minExperienceLevel: null,
      remotePolicy: null,
      salaryMin: null,
      salaryMax: null,
      latitude: null,
      longitude: null,
      createdAt: new Date('2026-10-01T00:00:00Z'),
      offerTags: [],
    });
    const indexed = (...ids: number[]) => ({
      hits: { hits: ids.map((id) => ({ _id: String(id), sort: [id] })) },
    });

    let offers: Map<number, { id: number; status: string }>;
    let warn: jest.SpyInstance;

    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['setImmediate'] });
      offers = new Map();
      prisma.offer.findMany.mockImplementation(() =>
        Promise.resolve(
          [...offers.values()]
            .filter(({ status }) => status === 'open')
            .map(({ id }) => ({ id })),
        ),
      );
      prisma.offer.findUnique.mockImplementation(
        ({ where }: { where: { id: number } }) =>
          Promise.resolve(offers.get(where.id) ?? null),
      );
      elastic.indices.exists.mockReset().mockResolvedValue(true);
      elastic.search.mockReset().mockResolvedValue(indexed());
      elastic.index.mockReset().mockResolvedValue({});
      elastic.delete.mockReset().mockResolvedValue({});
      warn = jest.spyOn(Logger.prototype, 'warn');
    });

    afterEach(() => {
      jest.useRealTimers();
      prisma.offer.findMany.mockReset().mockResolvedValue([]);
      prisma.offer.findUnique.mockReset();
      warn.mockRestore();
    });

    it('indexes an offer opened and removes one closed while Elasticsearch was down', async () => {
      offers.set(1, { ...openOffer(1), status: 'closed' });
      elastic.search.mockResolvedValue(indexed(1));
      const service = new OfferSearchService(prisma as never);
      service.onModuleInit();
      await settle();
      jest.clearAllMocks();

      // The outage: both writes fail.
      elastic.index.mockRejectedValue(connectionRefused);
      elastic.delete.mockRejectedValue(connectionRefused);
      elastic.indices.exists.mockRejectedValue(connectionRefused);
      offers.set(2, openOffer(2));
      await service.syncOffer(2);
      await service.syncOffer(1);
      await settle();
      expect(elastic.index).toHaveBeenCalledTimes(1);

      // Elasticsearch is back, still holding the closed offer only.
      elastic.index.mockResolvedValue({});
      elastic.delete.mockResolvedValue({});
      elastic.indices.exists.mockResolvedValue(true);
      await jest.advanceTimersByTimeAsync(5_000);
      await settle();

      expect(elastic.index).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: '2' }),
      );
      expect(elastic.delete).toHaveBeenLastCalledWith(
        { index: 'rekr-offers-v2', id: '1' },
        { ignore: [404] },
      );
      expect(warn).toHaveBeenCalledWith(
        'Elasticsearch drift: 1 open offers missing from the index, ' +
          '1 indexed offers no longer open.',
      );
      expect(jest.getTimerCount()).toBe(0);
    });

    it('re-aligns an existing index at startup, edits included', async () => {
      offers.set(3, openOffer(3));
      offers.set(4, openOffer(4));
      elastic.search.mockResolvedValue(indexed(3, 4));
      const service = new OfferSearchService(prisma as never);

      service.onModuleInit();
      await settle();

      expect(elastic.indices.create).not.toHaveBeenCalled();
      expect(elastic.index).toHaveBeenCalledTimes(2);
      expect(warn).not.toHaveBeenCalled();
    });

    it('pages through the whole index', async () => {
      const firstPage = Array.from({ length: 250 }, (_, i) => i + 1);
      elastic.search
        .mockResolvedValueOnce(indexed(...firstPage))
        .mockResolvedValueOnce(indexed(251));
      const service = new OfferSearchService(prisma as never);

      service.onModuleInit();
      await settle();

      type PageRequest = { search_after?: unknown };
      const calls = elastic.search.mock.calls as unknown as PageRequest[][];
      expect(calls).toHaveLength(2);
      expect(calls[1][0].search_after).toEqual([250]);
      expect(elastic.delete).toHaveBeenCalledTimes(251);
    });

    it('does not reconcile again for a request Elasticsearch rejected', async () => {
      const service = new OfferSearchService(prisma as never);
      service.onModuleInit();
      await settle();
      jest.clearAllMocks();
      elastic.search.mockRejectedValue(
        Object.assign(new Error('parsing_exception'), {
          meta: { statusCode: 400 },
        }),
      );

      await service.rankOfferIds(
        {
          jobFamilyIds: [],
          primaryJobFamilyId: null,
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
        },
        20,
      );
      await settle();

      expect(elastic.indices.exists).not.toHaveBeenCalled();
    });

    it('recovers from a connection that never answered', async () => {
      const service = new OfferSearchService(prisma as never);
      service.onModuleInit();
      await settle();
      jest.clearAllMocks();
      // What the client really throws: a ConnectionError carries status 0.
      elastic.index.mockRejectedValueOnce(
        Object.assign(new Error('connection failed'), {
          meta: { statusCode: 0 },
        }),
      );
      offers.set(7, openOffer(7));

      await service.syncOffer(7);
      await settle();

      expect(elastic.indices.exists).toHaveBeenCalledTimes(1);
      expect(elastic.index).toHaveBeenCalledTimes(2);
    });

    it('recovers when the index has gone missing', async () => {
      const service = new OfferSearchService(prisma as never);
      service.onModuleInit();
      await settle();
      jest.clearAllMocks();
      elastic.search.mockRejectedValueOnce(
        Object.assign(new Error('index_not_found_exception'), {
          meta: { statusCode: 404 },
        }),
      );
      elastic.indices.exists.mockResolvedValue(false);

      await service.rankOfferIds(
        {
          jobFamilyIds: [],
          primaryJobFamilyId: null,
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
        },
        20,
      );
      await settle();

      expect(elastic.indices.create).toHaveBeenCalledTimes(1);
    });
  });
});
