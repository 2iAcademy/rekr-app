// Explicit snapshot of open offer IDs, without titles or personal details.
const { Client } = require('pg');
const { Kafka } = require('kafkajs');
const { randomUUID } = require('node:crypto');
async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  const producer = new Kafka({ clientId: 'rekr-catalog', brokers: (process.env.KAFKA_BOOTSTRAP_SERVERS || 'kafka:9092').split(',') }).producer();
  try {
    await db.connect(); await producer.connect();
    const { rows } = await db.query("SELECT id, fk_job_family FROM offer WHERE status = 'open' ORDER BY id");
    const occurred_at = new Date().toISOString();
    for (let i = 0; i < rows.length; i += 100) await producer.send({ topic: 'rekr.swipe-events', messages: rows.slice(i,i+100).map(row => ({ key: `catalog:${row.id}`, value: JSON.stringify({ schema_version: 1, event_id: randomUUID(), source: 'real', type: 'catalog', occurred_at, offer_id: row.id, candidate_id: null, job_family_id: row.fk_job_family, position: null }) })) });
    await producer.send({ topic: 'rekr.swipe-events', messages: [{ key: 'catalog-snapshot', value: JSON.stringify({ schema_version: 1, event_id: randomUUID(), source: 'real', type: 'catalog_snapshot', occurred_at, offer_id: 1, candidate_id: null, job_family_id: null, position: null }) }] });
    console.log(`Catalog: ${rows.length} open offers. Wait for sink before running Spark.`);
  } finally { await db.end(); await producer.disconnect(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
