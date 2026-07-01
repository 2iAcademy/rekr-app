import { Pool } from 'pg';
import { KafkaLogEvent } from '../kafka/log-event';

export class PostgresLogWriter {
  private readonly pool: Pool;

  constructor() {
    const connectionString =
      process.env.LOGS_DATABASE_URL ?? process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('LOGS_DATABASE_URL or DATABASE_URL is required.');
    }

    this.pool = new Pool({ connectionString });
  }

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS logs_raw (
        event_id UUID PRIMARY KEY,
        occurred_at TIMESTAMPTZ NOT NULL,
        level TEXT NOT NULL,
        service TEXT NOT NULL,
        logger TEXT,
        message TEXT NOT NULL,
        trace_id TEXT,
        span_id TEXT,
        user_id TEXT,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        kafka_topic TEXT NOT NULL,
        kafka_partition INTEGER NOT NULL,
        kafka_offset BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_logs_raw_occurred_at
        ON logs_raw (occurred_at DESC);

      CREATE INDEX IF NOT EXISTS idx_logs_raw_level
        ON logs_raw (level);

      CREATE INDEX IF NOT EXISTS idx_logs_raw_service
        ON logs_raw (service);
    `);
  }

  async upsert(event: KafkaLogEvent, kafkaMeta: {
    topic: string;
    partition: number;
    offset: string;
  }): Promise<void> {
    await this.pool.query(
      `
        INSERT INTO logs_raw (
          event_id,
          occurred_at,
          level,
          service,
          logger,
          message,
          trace_id,
          span_id,
          user_id,
          payload,
          kafka_topic,
          kafka_partition,
          kafka_offset
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10::jsonb,
          $11,
          $12,
          $13
        )
        ON CONFLICT (event_id) DO UPDATE SET
          occurred_at = EXCLUDED.occurred_at,
          level = EXCLUDED.level,
          service = EXCLUDED.service,
          logger = EXCLUDED.logger,
          message = EXCLUDED.message,
          trace_id = EXCLUDED.trace_id,
          span_id = EXCLUDED.span_id,
          user_id = EXCLUDED.user_id,
          payload = EXCLUDED.payload,
          kafka_topic = EXCLUDED.kafka_topic,
          kafka_partition = EXCLUDED.kafka_partition,
          kafka_offset = EXCLUDED.kafka_offset
      `,
      [
        event.eventId,
        event.occurredAt,
        event.level,
        event.service,
        event.logger,
        event.message,
        event.traceId,
        event.spanId,
        event.userId,
        JSON.stringify(event.payload),
        kafkaMeta.topic,
        kafkaMeta.partition,
        kafkaMeta.offset,
      ],
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
