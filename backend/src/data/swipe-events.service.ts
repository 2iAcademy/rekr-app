import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Kafka, logLevel, Producer } from 'kafkajs';
import { PrismaService } from '../prisma/prisma.service';

/** Local teaching prototype: bounded, best-effort delivery AFTER DB commits. */
@Injectable()
export class SwipeEventsService implements OnApplicationShutdown {
  private readonly logger = new Logger(SwipeEventsService.name);
  private readonly enabled = process.env.SWIPE_EVENTS_ENABLED === 'true';
  private producer?: Producer;
  private connecting?: Promise<void>;
  private pending = 0;
  private stopped = false;

  constructor(private readonly prisma: PrismaService) {}

  decision(
    type: 'like' | 'pass' | 'match',
    candidateId: number,
    offerId: number,
  ): void {
    this.enqueue(type, candidateId, [offerId]);
  }

  feed(candidateId: number, offerIds: number[]): void {
    this.enqueue('feed_delivered', candidateId, offerIds);
  }

  impression(candidateId: number, offerId: number, position: number): void {
    this.enqueue('impression', candidateId, [offerId], position);
  }

  private enqueue(
    type: string,
    candidateId: number,
    offerIds: number[],
    position: number | null = null,
  ): void {
    if (!this.enabled || this.stopped || offerIds.length === 0) return;
    if (this.pending >= 20) {
      this.logger.warn('swipe_events_dropped: queue_full');
      return;
    }
    // Capture occurrence time before asynchronous enrichment or broker retries.
    const occurredAt = new Date().toISOString();
    this.pending++;
    void this.publish(type, candidateId, offerIds, occurredAt, position)
      .catch(() => this.logger.warn('swipe_events_dropped: publish_failed'))
      .finally(() => this.pending--);
  }

  private async publish(
    type: string,
    candidateId: number,
    offerIds: number[],
    occurredAt: string,
    position: number | null,
  ): Promise<void> {
    const offers = await this.prisma.offer.findMany({
      where: { id: { in: offerIds } },
      select: { id: true, jobFamilyId: true },
    });
    if (!this.producer) {
      this.producer = new Kafka({
        clientId: 'rekr-swipe-producer',
        brokers: (process.env.KAFKA_BOOTSTRAP_SERVERS ?? 'kafka:9092').split(
          ',',
        ),
        connectionTimeout: 1000,
        requestTimeout: 2000,
        retry: { retries: 1 },
        logLevel: logLevel.NOTHING,
      }).producer();
    }
    this.connecting ??= this.producer.connect().catch((error: unknown) => {
      this.connecting = undefined;
      throw error;
    });
    await this.connecting;
    const byId = new Map(offers.map((offer) => [offer.id, offer]));
    const messages = offerIds.flatMap((offerId, index) => {
      const offer = byId.get(offerId);
      if (!offer) return [];
      return [
        {
          key: `${candidateId}:${offerId}`,
          value: JSON.stringify({
            schema_version: 1,
            event_id: randomUUID(),
            source: 'real',
            type,
            occurred_at: occurredAt,
            candidate_id: candidateId,
            offer_id: offerId,
            job_family_id: offer.jobFamilyId,
            position: type === 'feed_delivered' ? index + 1 : position,
          }),
        },
      ];
    });
    if (messages.length)
      await this.producer.send({
        topic: 'rekr.swipe-events',
        messages,
        timeout: 2000,
      });
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    await this.producer?.disconnect();
  }
}
