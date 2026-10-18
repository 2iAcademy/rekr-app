// Small local prototype: one atomic HDFS file per Kafka message.
// Offsets advance only after the final rename. Retry reuses the same filename.
const { Kafka } = require('kafkajs');
const { validateEvent, storeEvent } = require('./storage.cjs');
const consumer = new Kafka({ clientId: 'rekr-events-sink', brokers: (process.env.KAFKA_BOOTSTRAP_SERVERS || 'kafka:9092').split(',') }).consumer({ groupId: 'rekr-hdfs-v1', sessionTimeout: 60000 });
async function main() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'rekr.swipe-events', fromBeginning: true });
  await consumer.run({ autoCommit: false, eachMessage: async ({ topic, partition, message, heartbeat }) => {
    const event = validateEvent(JSON.parse(message.value.toString()));
    await storeEvent(event, partition, message.offset);
    await heartbeat();
    await consumer.commitOffsets([{ topic, partition, offset: (BigInt(message.offset) + 1n).toString() }]);
    console.log(JSON.stringify({ event: 'swipe_archived', partition, offset: message.offset, source: event.source }));
  }});
}
consumer.on(consumer.events.CRASH, ({ payload }) => { if (!payload.restart) process.exit(1); });
process.on('SIGTERM', () => { void consumer.disconnect().then(() => process.exit(0)); });
main().catch((error) => { console.error(error.message); process.exit(1); });
