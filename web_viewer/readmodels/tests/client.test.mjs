import test from 'node:test'; import assert from 'node:assert/strict';
import { ReadModelClient } from '../runtime/ReadModelClient.mjs';
const release = 'a'.repeat(64), origin = 'https://archive.invalid';
const desc = (id, kind = 'test') => ({ url: `/_catalog/v/${release}/${id}.json`, kind });
const response = data => new Response(JSON.stringify({ schema_version: 1, release, kind: 'test', data }), { headers: { 'content-type': 'application/json' } });
const delay = ms => new Promise(r => setTimeout(r, ms));
const deferred = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };

test('No constructor fetch; one route requests only its own data', async () => {
  const urls = []; const c = new ReadModelClient({ release, fetchImpl: async url => { urls.push(url); return response({ ok: true }); } });
  assert.equal(urls.length, 0); await c.load(desc('songs')); assert.equal(urls.length, 1); assert.match(urls[0], /songs.json$/); c.dispose();
});
test('One slow domain does not prevent another domain from resolving', async () => {
  const slow = deferred(); const c = new ReadModelClient({ release, timeoutMs: 500, fetchImpl: url => url.endsWith('cards.json') ? slow.promise : Promise.resolve(response('songs-ready')) });
  const abort = new AbortController(); const cards = c.load(desc('cards'), { signal: abort.signal }).catch(e => e);
  assert.equal(await c.load(desc('songs')), 'songs-ready'); abort.abort(); await cards; c.dispose();
});
test('Shared in-flight request survives one consumer leaving', async () => {
  const d = deferred(); let calls = 0; const c = new ReadModelClient({ release, fetchImpl: () => { calls++; return d.promise; } });
  const abort = new AbortController(); const first = c.load(desc('one'), { signal: abort.signal }).catch(e => e);
  const second = c.load(desc('one')); abort.abort(); d.resolve(response('ok'));
  await first; assert.equal(await second, 'ok'); assert.equal(calls, 1); c.dispose();
});
test('Body hang is bounded, failure is retryable immediately', async () => {
  let calls = 0; const c = new ReadModelClient({ release, timeoutMs: 25, fetchImpl: async () => {
    calls++; return calls === 1 ? { ok: true, headers: new Headers({ 'content-type': 'application/json' }), arrayBuffer: () => new Promise(() => {}) } : response('retry-ok');
  } });
  await assert.rejects(c.load(desc('one')), e => e.code === 'TIMEOUT');
  assert.equal(await c.load(desc('one')), 'retry-ok'); assert.equal(calls, 2); c.dispose();
});
test('HTTP error and HTML SPA fallback are not cached', async () => {
  for (const bad of [new Response('no', { status: 503 }), new Response('<html/>', { headers: { 'content-type': 'text/html' } })]) {
    let calls = 0; const c = new ReadModelClient({ release, fetchImpl: async () => ++calls === 1 ? bad : response('ok') });
    await assert.rejects(c.load(desc('x'))); assert.equal(await c.load(desc('x')), 'ok'); assert.equal(calls, 2); c.dispose();
  }
});
test('Decoded-body byte budget is enforced', async () => {
  const c = new ReadModelClient({ release, fetchImpl: async () => response('x'.repeat(100)) });
  await assert.rejects(c.load({ ...desc('x'), maxBytes: 16 }), e => e.code === 'BODY_BUDGET'); c.dispose();
});
test('Wrong release and wrong integrity are rejected', async () => {
  const c = new ReadModelClient({ release, fetchImpl: async () => response('ok') });
  await assert.rejects(c.load({ ...desc('x'), sha256: 'f'.repeat(64) }), e => e.code === 'HASH'); c.dispose();
  const d = new ReadModelClient({ release, fetchImpl: async () => new Response(JSON.stringify({ schema_version: 1, release: 'b'.repeat(64), kind: 'test', data: 1 }), { headers: { 'content-type': 'application/json' } }) });
  await assert.rejects(d.load(desc('x')), e => e.code === 'SCHEMA'); d.dispose();
});
test('LRU evicts old values and does not grow without bound', async () => {
  let calls = 0; const c = new ReadModelClient({ release, maxEntries: 2, fetchImpl: async () => { calls++; return response({ x: calls }); } });
  await c.load(desc('1')); await c.load(desc('2')); await c.load(desc('3')); assert.equal(c.inspect().entries, 2);
  await c.load(desc('1')); assert.equal(calls, 4); c.dispose();
});
test('Queue fills free slots without Promise.all batch barrier', async () => {
  const slow = deferred(), starts = []; const c = new ReadModelClient({ release, concurrency: 2, fetchImpl: url => { starts.push(url); return url.endsWith('/1.json') ? slow.promise : Promise.resolve(response('ok')); } });
  const p = c.load(desc('1')); await c.load(desc('2')); await c.load(desc('3')); assert.equal(starts.length, 3);
  slow.resolve(response('late')); await p; c.dispose();
});
test('Queued orphan is dropped without a network request', async () => {
  const one = deferred(), two = deferred(), starts = []; const c = new ReadModelClient({ release, concurrency: 2, fetchImpl: url => { starts.push(url); return starts.length === 1 ? one.promise : two.promise; } });
  const p1 = c.load(desc('1')), p2 = c.load(desc('2')); const abort = new AbortController();
  const p3 = c.load(desc('3'), { signal: abort.signal }).catch(e => e); abort.abort(); await p3;
  one.resolve(response('ok')); two.resolve(response('ok')); await Promise.all([p1,p2]); assert.equal(starts.length, 2); c.dispose();
});
test('Cross-origin and wrong-release URL rejected before fetch', async () => {
  let calls = 0; const c = new ReadModelClient({ release, fetchImpl: async () => { calls++; return response(1); } });
  await assert.rejects(c.load({ url: 'https://evil.invalid/x.json' }), e => e.code === 'BAD_URL');
  await assert.rejects(c.load({ url: '/_catalog/v/' + 'b'.repeat(64) + '/x.json' }), e => e.code === 'BAD_URL'); assert.equal(calls, 0); c.dispose();
});

test('Disposed client does not issue new network requests', async () => {
  let requests=0;
  const client=new ReadModelClient({release:'a'.repeat(64),fetchImpl:async()=>{requests++;return new Response('{}')}});
  client.dispose();
  await assert.rejects(client.load({url:`/_catalog/v/${'a'.repeat(64)}/test.json`}),error=>error.code==='DISPOSED');
  assert.equal(requests,0);
});
test('Entity descriptor identity cannot silently resolve to a different entity', async () => {
  const client=new ReadModelClient({release:'a'.repeat(64),fetchImpl:async()=>new Response(JSON.stringify({schema_version:1,release:'a'.repeat(64),kind:'test.detail',data:{id:'wrong'}}),{headers:{'Content-Type':'application/json'}})});
  await assert.rejects(client.load({url:`/_catalog/v/${'a'.repeat(64)}/test.json`,expectedId:'right'}),error=>error.code==='IDENTITY_MISMATCH');
  client.dispose();
});
