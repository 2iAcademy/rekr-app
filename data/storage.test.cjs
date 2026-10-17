const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateEvent, storeEvent } = require('./storage.cjs');
const event = { schema_version: 1, event_id: 'test-215', source: 'synthetic', type: 'like', occurred_at: '2026-10-16T12:00:00Z', candidate_id: 7, offer_id: 3, job_family_id: 1, position: null };
test('rejects malformed events and strips personal fields', () => {
  assert.equal(validateEvent({ ...event, email: 'not-for-lake' }).email, undefined);
  assert.throws(() => validateEvent({ ...event, occurred_at: '../../bad' }));
  assert.throws(() => validateEvent({ ...event, source: 'unknown' }));
  assert.throws(() => validateEvent({ ...event, candidate_id: null }));
  assert.doesNotThrow(() => validateEvent({ ...event, type: 'catalog_snapshot', candidate_id: null }));
});
test('existing final file makes replay idempotent', async () => {
  let calls = 0;
  await storeEvent(event, 0, '12', async () => { calls++; return new Response('{}'); });
  assert.equal(calls, 1);
});
test('writes data before atomic rename and separates date partitions', async () => {
  const calls = [];
  const replies = [new Response('', { status: 404 }), new Response('{}'), new Response(null, { status: 307, headers: { location: 'http://datanode:9864/webhdfs/v1/temp' } }), new Response('', { status: 201 }), new Response('{"boolean":true}')];
  await storeEvent(event, 2, '18', async (url, opts) => { calls.push({ url, opts }); return replies.shift(); });
  assert.match(calls[0].url, /date=2026-10-16\/2-18-test-215.json/);
  assert.deepEqual(JSON.parse(calls[3].opts.body), event);
  assert.match(calls[4].url, /op=RENAME/);
});
test('write failure rejects so the caller cannot commit the offset', async () => {
  const replies = [new Response('', { status: 404 }), new Response('{}'), new Response(null, { status: 307, headers: { location: 'http://datanode:9864/path' } }), new Response('', { status: 500 })];
  await assert.rejects(storeEvent(event, 0, '1', async () => replies.shift()), /WebHDFS 500/);
});
test('failed rename must not be acknowledged', async () => {
  const replies = [new Response('', { status: 404 }), new Response('{}'), new Response(null, { status: 307, headers: { location: 'http://datanode:9864/path' } }), new Response(''), new Response('{"boolean":false}')];
  await assert.rejects(storeEvent(event, 0, '1', async () => replies.shift()), /rename failed/);
});

test('WebHDFS HTTP client accepts an unsolicited 100 Continue before 201', async () => {
  const http = require('node:http');
  const { webhdfsRequest } = require('./storage.cjs');
  let received = '';
  const server = http.createServer((req, res) => {
    res.writeContinue();
    req.on('data', chunk => { received += chunk; });
    req.on('end', () => { res.writeHead(201, { 'Content-Length': '0', Connection: 'close' }); res.end(); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await webhdfsRequest(`http://127.0.0.1:${server.address().port}/file`, {
      method: 'PUT', body: JSON.stringify(event), signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(JSON.parse(received), event);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
