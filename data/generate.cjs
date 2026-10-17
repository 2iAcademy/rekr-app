// Run inside backend: node data/generate.cjs [number of decisions]
const { randomUUID } = require('node:crypto');
const count = Number(process.argv[2] || 500);
if (!Number.isSafeInteger(count) || count < 20 || count > 10000) throw new Error('Choose 20..10000 decisions');
let seed = 215;
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
async function main() {
  const start = Date.now() - 86400000;
  const messages = [];
  function event(type, offer, candidate, position, time) {
    messages.push({ key: `${candidate}:${offer}`, value: JSON.stringify({ schema_version: 1, event_id: randomUUID(), source: 'synthetic', type, occurred_at: new Date(time).toISOString(), offer_id: offer, candidate_id: candidate, job_family_id: offer % 3 + 1, position }) });
  }
  event('catalog_snapshot', 1, null, null, start);
  for (let offer = 1; offer <= 25; offer++) event('catalog', offer, null, null, start);
  for (let i = 0; i < count; i++) {
    const candidate = i + 1, offer = i % 20 + 1, position = i % 10 + 1, time = start + i * 1000;
    event('feed_delivered', offer, candidate, position, time);
    event('impression', offer, candidate, position, time + 100);
    // Deliberately injected bias for teaching; never evidence about REKR users.
    const liked = random() < 0.75 - 0.04 * position + (offer % 3 === 0 ? 0.1 : 0);
    event(liked ? 'like' : 'pass', offer, candidate, null, time + 200);
    if (liked && random() < 0.35) event('match', offer, candidate, null, time + 300000);
  }
  if (process.argv.includes('--stdout')) {
    console.log(messages.map(message => message.value).join('\n'));
    return;
  }
  const { Kafka } = require('kafkajs');
  const producer = new Kafka({ clientId: 'rekr-synthetic', brokers: (process.env.KAFKA_BOOTSTRAP_SERVERS || 'kafka:9092').split(',') }).producer();
  await producer.connect();
  try {
    for (let i = 0; i < messages.length; i += 100) await producer.send({ topic: 'rekr.swipe-events', messages: messages.slice(i, i + 100) });
    console.log(`Published ${messages.length} SYNTHETIC events; ${count} decisions. No application records created.`);
  } finally { await producer.disconnect(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
