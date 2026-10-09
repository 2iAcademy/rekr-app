import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Client, type estypes } from '@elastic/elasticsearch';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildOfferRankingQuery,
  type CandidateRankingProfile,
} from './ranking/offer-ranking';

const OFFERS_INDEX = 'rekr-offers-v2';
const BATCH_SIZE = 250;
const RETRY_INITIAL_DELAY_MS = 5_000;
const RETRY_MAX_DELAY_MS = 5 * 60_000;

interface OfferSearchDocument {
  id: number;
  status: string;
  jobFamilyId: number | null;
  skills: string[];
  contractType: string | null;
  minExperienceLevel: string | null;
  remotePolicy: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  location?: { lat: number; lon: number };
  createdAt: string;
}

/** Re-exported so callers keep importing the profile shape from the service. */
export type CandidateFeedRankingInput = CandidateRankingProfile;

@Injectable()
export class OfferSearchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OfferSearchService.name);
  private readonly client: Client | null;
  private rebuildPending = false;
  private recovering = false;
  private recoveryRequested = false;
  private retryTimer: NodeJS.Timeout | null = null;
  private retryDelayMs = RETRY_INITIAL_DELAY_MS;
  private closed = false;

  constructor(private readonly prisma: PrismaService) {
    const node = process.env.ELASTICSEARCH_NODE?.trim();
    const enabled = process.env.ELASTICSEARCH_ENABLED !== 'false';
    // Production runs Elastic security and hands the backend a least-privilege
    // API key scoped to the offers index. Left empty, the local single node
    // keeps working without credentials.
    const apiKey = process.env.ELASTICSEARCH_API_KEY?.trim();
    this.client =
      enabled && node
        ? new Client({
            node,
            requestTimeout: 2000,
            maxRetries: 1,
            ...(apiKey ? { auth: { apiKey } } : {}),
          })
        : null;
  }

  /**
   * Never awaits Elasticsearch: the backend often starts before it answers, and
   * the feeds work without it. Recovery runs in the background until it lands.
   */
  onModuleInit(): void {
    if (!this.client) return;

    this.rebuildPending =
      process.env.ELASTICSEARCH_REINDEX_ON_STARTUP === 'true';
    this.requestRecovery();
  }

  async onModuleDestroy(): Promise<void> {
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    await this.client?.close();
  }

  /**
   * Returns ranked ids only. PostgreSQL always re-applies feed eligibility and
   * reads the actual cards, so this index is never an authorization boundary.
   */
  async rankOfferIds(
    profile: CandidateFeedRankingInput,
    limit: number,
  ): Promise<number[] | null> {
    if (!this.client) return null;

    const { filter, functions } = buildOfferRankingQuery(profile);

    try {
      const response = await this.client.search<OfferSearchDocument>({
        index: OFFERS_INDEX,
        size: Math.min(limit * 3, 300),
        track_total_hits: false,
        query: {
          function_score: {
            query: { bool: { filter } },
            functions,
            // Every criterion adds its own points to a base of zero: the score
            // an offer carries is the sum of the weights it earned, and nothing
            // Elasticsearch computed on its own.
            score_mode: 'sum',
            boost_mode: 'replace',
          },
        },
        sort: [
          { _score: { order: 'desc' } },
          { createdAt: { order: 'desc' } },
          { id: { order: 'desc' } },
        ],
        _source: ['id'],
      });

      return response.hits.hits.flatMap((hit) => {
        const id = hit._source?.id ?? Number(hit._id);
        return Number.isInteger(id) && id > 0 ? [id] : [];
      });
    } catch (cause) {
      this.logger.warn(
        `Elasticsearch search failed; candidate feeds will use PostgreSQL ordering. ${this.reasonOf(cause)}`,
      );
      this.recoverAfter(cause);
      return null;
    }
  }

  /**
   * Whether ranked feeds can be served right now. `disabled` is a deliberate
   * configuration, not an outage: the feeds then use PostgreSQL ordering.
   */
  async availability(): Promise<'disabled' | 'available' | 'unavailable'> {
    if (!this.client) return 'disabled';

    try {
      const exists = await this.client.indices.exists(
        { index: OFFERS_INDEX },
        { requestTimeout: 2000, maxRetries: 0 },
      );
      return exists ? 'available' : 'unavailable';
    } catch (cause) {
      this.logger.warn(
        `Elasticsearch health check failed. ${this.reasonOf(cause)}`,
      );
      return 'unavailable';
    }
  }

  /**
   * Makes an offer searchable after its PostgreSQL transaction has committed.
   * Never fails the caller: a write lost to an outage is caught up by the
   * recovery that follows.
   */
  async syncOffer(offerId: number): Promise<void> {
    if (!this.client) return;

    try {
      await this.writeOffer(offerId);
    } catch (cause) {
      this.logger.warn(
        `Could not sync offer ${offerId} to Elasticsearch. ${this.reasonOf(cause)}`,
      );
      this.recoverAfter(cause);
    }
  }

  /** Copies the offer as PostgreSQL holds it now, or removes it if not open. */
  private async writeOffer(offerId: number): Promise<void> {
    const client = this.client!;
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      select: {
        id: true,
        status: true,
        jobFamilyId: true,
        contractType: true,
        minExperienceLevel: true,
        remotePolicy: true,
        salaryMin: true,
        salaryMax: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        offerTags: {
          where: { tag: { category: { in: ['skill', 'tech'] } } },
          select: { tag: { select: { label: true } } },
        },
      },
    });

    if (!offer || offer.status !== 'open') {
      // Already absent is the state we want, not a failure.
      await client.delete(
        { index: OFFERS_INDEX, id: String(offerId) },
        { ignore: [404] },
      );
      return;
    }

    const latitude = offer.latitude === null ? null : Number(offer.latitude);
    const longitude = offer.longitude === null ? null : Number(offer.longitude);
    const document: OfferSearchDocument = {
      id: offer.id,
      status: offer.status,
      jobFamilyId: offer.jobFamilyId,
      skills: offer.offerTags.map((link) => link.tag.label),
      contractType: offer.contractType,
      minExperienceLevel: offer.minExperienceLevel,
      remotePolicy: offer.remotePolicy,
      salaryMin: offer.salaryMin,
      salaryMax: offer.salaryMax,
      ...(latitude !== null && longitude !== null
        ? { location: { lat: latitude, lon: longitude } }
        : {}),
      createdAt: offer.createdAt.toISOString(),
    };
    await client.index({
      index: OFFERS_INDEX,
      id: String(offer.id),
      document,
      refresh: false,
    });
  }

  /**
   * Recovers from anything but a request Elasticsearch answered and rejected
   * (400, 401, 403): a full reconciliation would fail the same way, on every
   * feed served. A missing index (404) is recovered. A connection that never
   * answered carries status 0, not none.
   */
  private recoverAfter(cause: unknown): void {
    const status = (cause as { meta?: { statusCode?: unknown } } | null)?.meta
      ?.statusCode;
    const rejected =
      typeof status === 'number' &&
      status >= 400 &&
      status < 500 &&
      status !== 404;
    if (!rejected) this.requestRecovery();
  }

  /**
   * Starts a recovery unless one is waiting to retry. One asked while another
   * runs is replayed after it, since that run may have read PostgreSQL before
   * the write that failed.
   */
  private requestRecovery(): void {
    if (this.closed || this.retryTimer) return;
    if (this.recovering) {
      this.recoveryRequested = true;
      return;
    }

    void this.recover();
  }

  /**
   * Makes the index usable again and re-aligns it on PostgreSQL, then retries
   * with a growing delay until it succeeds. Meanwhile the feeds keep their
   * PostgreSQL ordering.
   */
  private async recover(): Promise<void> {
    this.recovering = true;
    this.recoveryRequested = false;
    try {
      await this.ensureIndex();
      await this.reconcile();
      this.retryDelayMs = RETRY_INITIAL_DELAY_MS;
    } catch (cause) {
      this.scheduleRetry(cause);
    } finally {
      this.recovering = false;
    }
    if (this.recoveryRequested) this.requestRecovery();
  }

  private scheduleRetry(cause: unknown): void {
    if (this.closed) return;

    const delayMs = this.retryDelayMs;
    this.retryDelayMs = Math.min(delayMs * 2, RETRY_MAX_DELAY_MS);
    this.logger.warn(
      `Elasticsearch is unavailable; candidate feeds will use PostgreSQL ordering. ` +
        `Retrying in ${delayMs / 1000}s. ${this.reasonOf(cause)}`,
    );
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.requestRecovery();
    }, delayMs);
    // A pending retry must never be what keeps the process alive.
    this.retryTimer.unref();
  }

  private async ensureIndex(): Promise<void> {
    const client = this.client!;
    let exists = await client.indices.exists({ index: OFFERS_INDEX });
    if (exists && this.rebuildPending) {
      await client.indices.delete({ index: OFFERS_INDEX });
      exists = false;
    }
    if (!exists) await this.createIndex();
    this.rebuildPending = false;
  }

  private async createIndex(): Promise<void> {
    await this.client!.indices.create({
      index: OFFERS_INDEX,
      settings: { number_of_replicas: 0 },
      mappings: {
        properties: {
          id: { type: 'integer' },
          status: { type: 'keyword' },
          jobFamilyId: { type: 'integer' },
          skills: { type: 'keyword' },
          contractType: { type: 'keyword' },
          minExperienceLevel: { type: 'keyword' },
          remotePolicy: { type: 'keyword' },
          salaryMin: { type: 'integer' },
          salaryMax: { type: 'integer' },
          location: { type: 'geo_point' },
          createdAt: { type: 'date' },
        },
      },
    });
  }

  /**
   * Re-aligns the index on PostgreSQL, the source of truth. Every open offer is
   * written again, so one edited during an outage is caught up too, and every
   * indexed offer no longer open is removed. The gap is logged before it is
   * fixed, so an outage that cost something shows in the logs.
   */
  private async reconcile(): Promise<void> {
    const openIds = await this.openOfferIds();
    const indexedIds = await this.indexedOfferIds();
    const missing = [...openIds].filter((id) => !indexedIds.has(id)).length;
    const stale = [...indexedIds].filter((id) => !openIds.has(id));

    const drift =
      `Elasticsearch drift: ${missing} open offers missing from the index, ` +
      `${stale.length} indexed offers no longer open.`;
    if (missing > 0 || stale.length > 0) this.logger.warn(drift);
    else this.logger.log(drift);

    for (const id of openIds) await this.writeOffer(id);
    // Re-read rather than deleted blindly: an offer opened since the first
    // read is indexed instead.
    for (const id of stale) await this.writeOffer(id);
  }

  private async openOfferIds(): Promise<Set<number>> {
    const ids = new Set<number>();
    let afterId: number | undefined;
    for (;;) {
      const offers = await this.prisma.offer.findMany({
        where: { status: 'open' },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(afterId === undefined ? {} : { cursor: { id: afterId }, skip: 1 }),
        select: { id: true },
      });
      for (const offer of offers) ids.add(offer.id);
      afterId = offers.at(-1)?.id;
      if (offers.length < BATCH_SIZE || afterId === undefined) return ids;
    }
  }

  private async indexedOfferIds(): Promise<Set<number>> {
    const ids = new Set<number>();
    let searchAfter: estypes.SortResults | undefined;
    for (;;) {
      const response = await this.client!.search<OfferSearchDocument>({
        index: OFFERS_INDEX,
        size: BATCH_SIZE,
        track_total_hits: false,
        query: { match_all: {} },
        sort: [{ id: { order: 'asc' } }],
        _source: false,
        ...(searchAfter ? { search_after: searchAfter } : {}),
      });
      const { hits } = response.hits;
      for (const hit of hits) {
        const id = Number(hit._id);
        if (Number.isInteger(id) && id > 0) ids.add(id);
      }
      searchAfter = hits.at(-1)?.sort;
      if (hits.length < BATCH_SIZE || !searchAfter) return ids;
    }
  }

  private reasonOf(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
  }
}
