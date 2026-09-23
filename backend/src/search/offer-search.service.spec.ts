import { Client } from '@elastic/elasticsearch';
import { OfferSearchService } from './offer-search.service';
import { CRITERION_WEIGHTS } from './ranking/ranking-rules';

jest.mock('@elastic/elasticsearch', () => ({ Client: jest.fn() }));

const mockedClient = Client as jest.MockedClass<typeof Client>;

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

    await service.onModuleInit();

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

    expect(elastic.delete).toHaveBeenCalledWith({
      index: 'rekr-offers-v2',
      id: '42',
    });
    expect(elastic.index).not.toHaveBeenCalled();
  });
});
