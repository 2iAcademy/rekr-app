const http = require('node:http');
// WebHDFS sends an interim HTTP 100 response for DataNode writes.
// Node's HTTP client accepts it, including when no Expect header was sent.
function webhdfsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.body;
    const headers = { ...options.headers };
    if (body !== undefined) headers['Content-Length'] = Buffer.byteLength(body);
    const req = http.request(url, { method: options.method || 'GET', headers, signal: options.signal }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => resolve(new Response(Buffer.concat(chunks), {
        status: res.statusCode, headers: res.headers,
      })));
    });
    req.on('error', reject);
    req.end(body);
  });
}
const TYPES = ['like', 'pass', 'match', 'feed_delivered', 'impression', 'catalog', 'catalog_snapshot'];
function validateEvent(e) {
  if (e.schema_version !== 1 || !['real', 'synthetic'].includes(e.source) || !TYPES.includes(e.type) ||
      typeof e.event_id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(e.event_id) ||
      typeof e.occurred_at !== 'string' || !Number.isFinite(Date.parse(e.occurred_at)) ||
      !Number.isSafeInteger(e.offer_id) || e.offer_id < 1 ||
      (!['catalog', 'catalog_snapshot'].includes(e.type) && (!Number.isSafeInteger(e.candidate_id) || e.candidate_id < 1)) ||
      (e.job_family_id !== null && !Number.isSafeInteger(e.job_family_id)) ||
      (e.position !== null && (!Number.isSafeInteger(e.position) || e.position < 1))) throw new Error('Invalid swipe event; offset NOT committed');
  // Whitelist: arbitrary producer payloads must not introduce personal fields.
  return Object.fromEntries(['schema_version', 'event_id', 'source', 'type', 'occurred_at', 'candidate_id', 'offer_id', 'job_family_id', 'position'].map(k => [k, e[k] ?? null]));
}
async function storeEvent(e, partition, offset, request = webhdfsRequest) {
  const base = process.env.WEBHDFS_URL || 'http://namenode:9870';
  const dir = `/lake/raw/events/date=${new Date(e.occurred_at).toISOString().slice(0,10)}`;
  const path = `${dir}/${partition}-${offset}-${e.event_id}.json`;
  const url = (p, op) => `${base}/webhdfs/v1${p}?user.name=root&${op}`;
  const call = (u, options = {}) => request(u, { ...options, signal: AbortSignal.timeout(10000) });
  const check = async r => { if (!r.ok) throw new Error(`WebHDFS ${r.status}`); return r; };
  // A previous attempt may have renamed successfully before crashing/committing.
  const status = await call(url(path, 'op=GETFILESTATUS'));
  if (status.ok) return;
  if (status.status !== 404) await check(status);
  await check(await call(url(dir, 'op=MKDIRS'), { method: 'PUT' }));
  const tmp = `${dir}/._${partition}-${offset}-${e.event_id}.tmp`;
  const redirect = await call(url(tmp, 'op=CREATE&overwrite=true'), { method: 'PUT', redirect: 'manual' });
  if (redirect.status !== 307 || !redirect.headers.get('location')) throw new Error('WebHDFS did not return a DataNode redirect');
  const target = new URL(redirect.headers.get('location'));
  if (target.hostname !== 'datanode' || target.protocol !== 'http:') throw new Error('Unexpected DataNode address');
  await check(await call(target.href, { method: 'PUT', body: JSON.stringify(e) + '\n', headers: { 'Content-Type': 'application/octet-stream' } }));
  const renamed = await check(await call(url(tmp, `op=RENAME&destination=${encodeURIComponent(path)}`), { method: 'PUT' }));
  if (!(await renamed.json()).boolean) throw new Error('HDFS rename failed');
}
module.exports = { validateEvent, storeEvent, webhdfsRequest };
