import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildOfferRankingQuery,
  type CandidateRankingProfile,
} from './ranking/offer-ranking';

const OFFERS_INDEX = 'rekr-offers-v2';
const REINDEX_BATCH_SIZE = 250;

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

  constructor(private readonly prisma: PrismaService) {
    const node = process.env.ELASTICSEARCH_NODE?.trim();
    const enabled = process.env.ELASTICSEARCH_ENABLED !== 'false';
    this.client =
      enabled && node
        ? new Client({ node, requestTimeout: 2000, maxRetries: 1 })
        : null;
  }

  async onModuleInit(): Promise<void> {
    if (!this.client) return;

    try {
      const exists = await this.client.indices.exists({ index: OFFERS_INDEX });
      const rebuild = process.env.ELASTICSEARCH_REINDEX_ON_STARTUP === 'true';
      if (exists && rebuild) {
        await this.client.indices.delete({ index: OFFERS_INDEX });
      }
      if (!exists || rebuild) {
        await this.createIndex();
        await this.reindexAll();
      }
    } catch (cause) {
      this.logger.warn(
        `Elasticsearch is unavailable; candidate feeds will use PostgreSQL ordering. ${this.reasonOf(cause)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
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
      return null;
    }
  }

  /** Makes an offer searchable after its PostgreSQL transaction has committed. */
  async syncOffer(offerId: number): Promise<void> {
    if (!this.client) return;

    try {
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
        await this.client
          .delete({ index: OFFERS_INDEX, id: String(offerId) })
          .catch(() => undefined);
        return;
      }

      const latitude = offer.latitude === null ? null : Number(offer.latitude);
      const longitude =
        offer.longitude === null ? null : Number(offer.longitude);
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
      await this.client.index({
        index: OFFERS_INDEX,
        id: String(offer.id),
        document,
        refresh: false,
      });
    } catch (cause) {
      this.logger.warn(
        `Could not sync offer ${offerId} to Elasticsearch. ${this.reasonOf(cause)}`,
      );
    }
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
  private async reindexAll(): Promise<void> {
    let afterId: number | undefined;
    do {
      const offers = await this.prisma.offer.findMany({
        where: { status: 'open' },
        orderBy: { id: 'asc' },
        take: REINDEX_BATCH_SIZE,
        ...(afterId === undefined ? {} : { cursor: { id: afterId }, skip: 1 }),
        select: { id: true },
      });
      for (const offer of offers) await this.syncOffer(offer.id);
      afterId = offers.at(-1)?.id;
      if (offers.length < REINDEX_BATCH_SIZE) return;
    } while (afterId !== undefined);
  }

  private reasonOf(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
  }
}
