/** Optional media-only cache adapter. Read models use Pages static serving instead.
 * Call after path validation or keep `next` as the original validated handler.
 * Cache API HIT still executes a Function; it avoids R2 operations, not Function billing.
 */
export async function withPublicMediaCache(context, next, cache = globalThis.caches?.default) {
  const { request, env } = context;
  const url = new URL(request.url);
  const eligible = request.method === 'GET' && /^\/assets\/.+\.(png|webp|jpg|jpeg|atlas|skel)$/i.test(url.pathname)
    && !['authorization','cookie','range','if-range','if-none-match','if-modified-since','if-match','if-unmodified-since'].some(name => request.headers.has(name));
  const epoch = env.ARCHIVE_MEDIA_EPOCH;
  if (!eligible || !cache || !/^[a-zA-Z0-9_.-]{1,80}$/.test(epoch || '')) return next();
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return next(); }
  if (pathname.split('/').some(part => part === '..' || part === '.') || /[\\\u0000-\u001f]/.test(pathname)) return next();
  // Logical asset paths are stable and the original handler ignores query. Epoch includes media replacement, not just JSON revision.
  const key = new Request(`${url.origin}/__internal_media_cache/${epoch}${url.pathname}`);
  let hit;
  try { hit = await cache.match(key); } catch { return next(); }
  if (hit) {
    const headers = new Headers(hit.headers); headers.set('X-Archive-Media-Cache', 'HIT');
    return new Response(hit.body, { status: hit.status, headers });
  }
  const result = await next();
  const control = result.headers.get('cache-control') || '';
  const length = Number(result.headers.get('content-length'));
  const cacheable = result.status === 200 && !result.headers.has('set-cookie') && !result.headers.has('content-encoding')
    && /(?:^|,)\s*public\b/i.test(control) && !/private|no-store|no-cache/i.test(control)
    && Number.isSafeInteger(length) && length > 0 && length <= 8 * 1024 * 1024;
  if (!cacheable) return result; // Preserve original encoded response; never re-wrap gzip as automatic.
  const headers = new Headers(result.headers); headers.set('X-Archive-Media-Cache', 'MISS');
  if (cacheable && typeof context.waitUntil === 'function') {
    context.waitUntil(cache.put(key, result.clone()).catch(() => {}));
  }
  return new Response(result.body, { status: result.status, headers });
}
