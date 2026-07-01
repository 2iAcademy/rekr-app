import { Kafka } from 'kafkajs';
import { KafkaLogEvent } from './kafka/log-event';
import { PostgresLogWriter } from './logs-sink/postgres-log-writer';

async function main() {
  const brokers = (process.env.KAFKA_BOOTSTRAP_SERVERS ?? 'localhost:29092')
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);
  const topic = process.env.KAFKA_TOPIC ?? 'logs.raw';
  const groupId = process.env.KAFKA_GROUP_ID ?? 'rekr-logs-sink';

  const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID ?? 'rekr-logs-sink',
    brokers,
  });
  const admin = kafka.admin();
  const consumer = kafka.consumer({ groupId });
  const writer = new PostgresLogWriter();

  await writer.ensureSchema();
  await admin.connect();
  await admin.createTopics({
    waitForLeaders: true,
    topics: [
      {
        topic,
        numPartitions: Number(process.env.KAFKA_TOPIC_PARTITIONS ?? 3),
        replicationFactor: Number(process.env.KAFKA_TOPIC_REPLICATION_FACTOR ?? 1),
      },
    ],
  });
  await admin.disconnect();
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });

  const shutdown = async () => {
    await consumer.disconnect();
    await writer.close();
  };

  process.once('SIGINT', () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.once('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0));
  });

  console.log(`[logs-sink] consuming ${topic} from ${brokers.join(', ')}`);

  await consumer.run({
    eachMessage: async ({ topic: messageTopic, partition, message }) => {
      if (!message.value) {
        throw new Error('Kafka message is empty.');
      }

      const event = JSON.parse(
        message.value.toString('utf8'),
      ) as KafkaLogEvent;

      await writer.upsert(event, {
        topic: messageTopic,
        partition,
        offset: message.offset,
      });

      console.log(
        `[logs-sink] stored ${event.eventId} from partition ${partition} offset ${message.offset}`,
      );
    },
  });
}

main().catch((error) => {
  console.error('[logs-sink] fatal error', error);
  process.exitCode = 1;
});
