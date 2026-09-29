import test from 'node:test'; import assert from 'node:assert/strict';
import { withPublicMediaCache } from '../reference/cloudflare/publicMediaCache.mjs';
import { readMetadataOrFullObject } from '../reference/cloudflare/singleGetFastPath.mjs';

test('unconditional GET uses one get and zero head', async () => {
  let head = 0, get = 0; const bucket = { head: async () => { head++; return {}; }, get: async () => { get++; return { body: new ReadableStream({ start(c) { c.close(); } }) }; } };
  const result = await readMetadataOrFullObject(bucket, 'x', new Request('https://a.invalid/x'));
  assert.equal(result.full, true); assert.equal(head, 0); assert.equal(get, 1); await result.discard();
});
test('HEAD and Range preserve original metadata branch', async () => {
  for (const init of [{ method: 'HEAD' }, { headers: { Range: 'bytes=0-9' } }, { headers: { 'If-None-Match': '"v"' } }]) {
    let head = 0, get = 0; const bucket = { head: async () => { head++; return {}; }, get: async () => { get++; } };
    const result = await readMetadataOrFullObject(bucket, 'x', new Request('https://a.invalid/x', init));
    assert.equal(result.full, false); assert.equal(head, 1); assert.equal(get, 0);
  }
});
test('media cache second GET avoids origin callback, epoch isolates updates', async () => {
  const entries = new Map(); const cache = { match: async req => entries.get(req.url)?.clone(), put: async (req,res) => { entries.set(req.url, res); } };
  let calls = 0; const writes = [];
  const ctx = { request: new Request('https://a.invalid/assets/x.webp'), env: { ARCHIVE_MEDIA_EPOCH: 'voice64-v1' }, waitUntil: p => writes.push(p) };
  const next = async () => { calls++; return new Response('test', { headers: { 'cache-control': 'public, max-age=3600', 'content-length':'4', 'content-type':'image/webp' } }); };
  await withPublicMediaCache(ctx, next, cache); await Promise.all(writes);
  const hit = await withPublicMediaCache(ctx, next, cache); assert.equal(hit.headers.get('X-Archive-Media-Cache'), 'HIT'); assert.equal(calls,1);
  ctx.env.ARCHIVE_MEDIA_EPOCH='voice64-v2'; await withPublicMediaCache(ctx,next,cache); assert.equal(calls,2);
});
test('encoded/partial/private/error responses never enter simple media cache', async () => {
  for (const init of [{ status:206 }, { status:503 }, { headers:{'content-encoding':'gzip'} }, { headers:{'set-cookie':'x=y'} }, { headers:{'cache-control':'private'} }]) {
    let put=0; const pending=[]; const cache={ match:async()=>null, put:async()=>{put++;} };
    const ctx={ request:new Request('https://a.invalid/assets/x.webp'),env:{ARCHIVE_MEDIA_EPOCH:'v1'},waitUntil:p=>pending.push(p) };
    await withPublicMediaCache(ctx,async()=>new Response('test',{status:init.status||200, headers:{'content-length':'4','cache-control':'public, max-age=3600',...init.headers}}),cache);
    await Promise.all(pending);assert.equal(put,0);
  }
});
