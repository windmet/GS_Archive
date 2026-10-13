import { isWithdrawnExternalStoryKey } from '../../shared/deploy/ExternalStoryResourcePolicy.js'
import { resolvePreviewObjectKey, previewGzipEnabled } from '../../shared/deploy/PreviewAssetTransform.js'

const TYPES = {
  '.atlas': 'text/plain; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8', '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.png': 'image/png',
  '.skel': 'application/octet-stream', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.woff2': 'font/woff2',
}

function contentType(key, object) {
  const declared = object.httpMetadata?.contentType
  if (declared && declared !== 'application/octet-stream') return declared
  return TYPES[key.slice(key.lastIndexOf('.')).toLowerCase()] || declared || 'application/octet-stream'
}

function acceptsGzip(value) {
  // Missing Accept-Encoding imposes no preference (RFC 9110). Explicit
  // gzip;q=0 overrides wildcard; never send gzip to an identity-only client.
  if (value === null) return true
  const encodings = value.toLowerCase().split(',').map(part => {
    const [name, ...parameters] = part.trim().split(';')
    const q = parameters.find(p => p.trim().startsWith('q='))
    return [name.trim(), q ? Number(q.trim().slice(2)) : 1]
  })
  const quality = encodings.find(([name]) => name === 'gzip') ?? encodings.find(([name]) => name === '*')
  return !!quality && Number.isFinite(quality[1]) && quality[1] > 0 && quality[1] <= 1
}

function requestedRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value || '')
  if (!match || (!match[1] && !match[2])) return null
  let start, end
  if (!match[1]) {
    const suffix = Number(match[2])
    if (!Number.isSafeInteger(suffix) || suffix === 0) return null
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] ? Number(match[2]) : size - 1
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return null
  }
  if (start >= size || end < start) return null
  return { start, end: Math.min(end, size - 1) }
}

// Image edge cache (experiment, docs/GS_ARCHIVE_PREVIEW_IMAGE_EDGE_CACHE_20261013.md). With ARCHIVE_EDGE_CACHE=images,
// whole-object GETs for pictures under /assets/ are kept in the data centre's cache, keyed by data revision and
// object key: a hit skips the R2 head and get, but this Function still runs. Ranged requests, audio, data and
// JSON are untouched, and a new R2 snapshot (new revision) misses cleanly. X-GS-Edge-Cache reports HIT or MISS.
const EDGE_CACHE_PICTURE = /\.(png|webp|jpe?g)$/i
const EDGE_CACHE_TTL = 86400

function edgeCacheKey(request, env, prefix, objectKey) {
  if (env.ARCHIVE_EDGE_CACHE !== 'images' || typeof caches === 'undefined' || !env.ARCHIVE_DATA_REVISION) return null
  if (prefix !== 'assets' || !EDGE_CACHE_PICTURE.test(objectKey) || request.headers.has('Range')) return null
  return new Request(`${new URL(request.url).origin}/__edge-cache/${env.ARCHIVE_DATA_REVISION}/${objectKey}`)
}

const matchesValidator = (request, etag) => {
  const validators = request.headers.get('If-None-Match')?.split(',').map(value => value.trim().replace(/^W\//, ''))
  return !!validators && (validators.includes('*') || (!!etag && validators.includes(etag.replace(/^W\//, ''))))
}

export async function serveR2Resource({ request, env, prefix, waitUntil }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } })
  }
  if (!env.ARCHIVE_ASSETS) return new Response('Preview R2 binding missing', { status: 503 })
  const url = new URL(request.url)
  let decoded
  try { decoded = decodeURIComponent(url.pathname) } catch { return new Response(null, { status: 400 }) }
  if (!decoded.startsWith(`/${prefix}/`)) return new Response(null, { status: 404 })
  const relative = decoded.slice(prefix.length + 2)
  if (!relative || relative.split('/').some(part => !part || part === '.' || part === '..' || part.includes('\\') || /[\u0000-\u001f]/.test(part))) {
    return new Response(null, { status: 400 })
  }
  // The request key is the frozen public contract; the object key is what the
  // deployment actually stored. Content type follows the object, not the URL.
  const requestKey = `${prefix}/${relative}`
  if (isWithdrawnExternalStoryKey(requestKey)) {
    return new Response('This resource is not currently published.', {
      status: 410, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  const gzip = previewGzipEnabled(env, requestKey)
  const objectKey = resolvePreviewObjectKey(requestKey, { gzip, dataRevision: env.ARCHIVE_DATA_REVISION })
  // Cloudflare normalizes the forwarded header; negotiate using the client's
  // original value when the edge provides it (including an empty string).
  const acceptEncoding = request.cf?.clientAcceptEncoding ?? request.headers.get('Accept-Encoding')
  if (gzip && !acceptsGzip(acceptEncoding)) {
    return new Response(null, { status: 406, headers: { Vary: 'Accept-Encoding', 'Cache-Control': 'no-store' } })
  }
  const cacheKey = edgeCacheKey(request, env, prefix, objectKey)
  if (cacheKey) {
    const cached = await caches.default.match(cacheKey)
    if (cached) {
      const headers = new Headers(cached.headers)
      headers.set('Cache-Control', 'public, max-age=3600')
      headers.set('X-GS-Edge-Cache', 'HIT')
      if (matchesValidator(request, headers.get('ETag'))) {
        headers.delete('Content-Length')
        return new Response(null, { status: 304, headers, encodeBody: 'manual' })
      }
      return new Response(request.method === 'HEAD' ? null : cached.body, { status: 200, headers, encodeBody: 'manual' })
    }
  }
  const bucket = env.ARCHIVE_ASSETS
  const meta = await bucket.head(objectKey)
  if (!meta) return new Response(null, { status: 404 })
  const etag = meta.httpEtag || (meta.etag ? `"${meta.etag}"` : undefined)
  // Fail closed on a bad upload instead of returning compressed bytes as JSON.
  const gzipType = requestKey.endsWith('.json') ? 'application/json' : 'application/octet-stream'
  if (gzip && (meta.httpMetadata?.contentEncoding !== 'gzip'
    || meta.httpMetadata?.contentType?.split(';')[0].trim() !== gzipType)) {
    return new Response('Invalid structured resource metadata', { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
  const headers = new Headers()
  meta.writeHttpMetadata?.(headers)
  headers.set('Cache-Control', 'public, max-age=3600')
  headers.set('Content-Length', String(meta.size))
  headers.set('Content-Type', contentType(objectKey, meta))
  if (gzip) {
    headers.set('Content-Encoding', 'gzip')
    headers.set('Vary', 'Accept-Encoding')
    headers.delete('Accept-Ranges')
    headers.delete('Content-Range')
  } else headers.set('Accept-Ranges', 'bytes')
  if (etag) headers.set('ETag', etag)
  if (cacheKey) headers.set('X-GS-Edge-Cache', 'MISS')
  if (matchesValidator(request, etag)) {
    headers.delete('Content-Length')
    return new Response(null, { status: 304, headers, encodeBody: 'manual' })
  }
  const rangeHeader = gzip ? null : request.headers.get('Range')
  const range = rangeHeader && (!request.headers.has('If-Range') || request.headers.get('If-Range') === etag)
    ? requestedRange(rangeHeader, meta.size) : undefined
  if (rangeHeader && range === null) {
    headers.set('Content-Range', `bytes */${meta.size}`)
    headers.delete('Content-Length')
    return new Response(null, { status: 416, headers })
  }
  if (range) {
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${meta.size}`)
    headers.set('Content-Length', String(range.end - range.start + 1))
  }
  if (request.method === 'HEAD') return new Response(null, { status: range ? 206 : 200, headers, encodeBody: 'manual' })
  const object = await bucket.get(objectKey, range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined)
  if (!object) return new Response(null, { status: 404 })
  if (cacheKey && !range && typeof waitUntil === 'function') {
    const [body, copy] = object.body.tee()
    const stored = new Headers(headers)
    stored.set('Cache-Control', `public, max-age=${EDGE_CACHE_TTL}`)
    stored.delete('X-GS-Edge-Cache')
    waitUntil(caches.default.put(cacheKey, new Response(copy, { status: 200, headers: stored })).catch(() => {}))
    return new Response(body, { status: 200, headers, encodeBody: 'manual' })
  }
  return new Response(object.body, { status: range ? 206 : 200, headers, encodeBody: 'manual' })
}
