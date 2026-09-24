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

export async function serveR2Resource({ request, env, prefix }) {
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
  const gzip = previewGzipEnabled(env, requestKey)
  const objectKey = resolvePreviewObjectKey(requestKey, { gzip })
  if (gzip && !acceptsGzip(request.headers.get('Accept-Encoding'))) {
    return new Response(null, { status: 406, headers: { Vary: 'Accept-Encoding', 'Cache-Control': 'no-store' } })
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
  const validators = request.headers.get('If-None-Match')?.split(',').map(value => value.trim().replace(/^W\//, ''))
  if (validators?.includes('*') || (etag && validators?.includes(etag.replace(/^W\//, '')))) {
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
  return new Response(object.body, { status: range ? 206 : 200, headers, encodeBody: 'manual' })
}
