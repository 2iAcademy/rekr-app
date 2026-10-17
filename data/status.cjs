const { Kafka } = require('kafkajs');
async function main() {
  const admin = new Kafka({ clientId: 'rekr-data-status', brokers: (process.env.KAFKA_BOOTSTRAP_SERVERS || 'kafka:9092').split(',') }).admin();
  try {
    await admin.connect();
    const topic = 'rekr.swipe-events';
    const latest = await admin.fetchTopicOffsets(topic);
    const groups = await admin.fetchOffsets({ groupId: 'rekr-hdfs-v1', topics: [topic] });
    const offsets = groups.find(g => g.topic === topic)?.partitions || [];
    let behind = false;
    for (const partition of latest) {
      const committed = offsets.find(p => p.partition === partition.partition)?.offset || '-1';
      const next = BigInt(committed) < 0n ? BigInt(partition.low) : BigInt(committed);
      const lag = BigInt(partition.high) - next;
      behind ||= lag !== 0n;
      console.log(`Partition ${partition.partition}: ${lag} pending event(s)`);
    }
    process.exitCode = behind ? 1 : 0;
  } finally { await admin.disconnect(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
