import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { serveR2Resource } from '../functions/_shared/r2-resource.js'
import { verifyStructuredGzip } from './verify-structured-gzip.mjs'

// Real Pages handler over a local R2 adapter. Only canary requests pass through
// it; other assets resolve through the fresh baseline. Frontend uses build:check.
// This proves local browser/HTTP decoding, not Cloudflare edge acceptance.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.resolve(process.argv[2] || '.deploy/storage-compression/canary-manifest.json')
const manifest = await verifyStructuredGzip(manifestPath)
const entries = new Map(manifest.entries.map(e => [e.object_key, e]))
const control = process.env.SIDEM_GZIP_CONTROL === '1'
const keys = new Set(control ? [] : manifest.entries.map(e => e.request_key))
const requestLog = path.join(path.dirname(manifestPath), 'canary-requests.jsonl')
const env = { ARCHIVE_GZIP_MODE: 'canary', ARCHIVE_GZIP_CANARY_KEYS: JSON.stringify([...keys]),
  ARCHIVE_ASSETS: {
    async head(key) {
      const entry = entries.get(key)
      if (!entry) return null
      const httpMetadata = { contentType: entry.deployed_content_type, contentEncoding: entry.deployed_content_encoding }
      return { size: entry.deployed_size, httpEtag: `"${entry.deployed_sha256}"`, httpMetadata,
        writeHttpMetadata(headers) { headers.set('Content-Type', httpMetadata.contentType); headers.set('Content-Encoding', httpMetadata.contentEncoding) } }
    },
    async get(key, options) {
      if (options?.range) throw new Error('gzip must not reach partial get')
      const entry = entries.get(key)
      return entry ? { body: await fs.readFile(path.join(path.dirname(manifestPath), manifest.stage, key)) } : null
    },
  } }
const baseline = JSON.parse(await fs.readFile(path.join(path.dirname(manifestPath), 'source-baseline.json'), 'utf8'))
const sources = new Map(baseline.entries.map(e => [e.request_key, e]))
const build = path.join(root, '.analysis/build-check')
await fs.access(path.join(build, 'index.html'))
async function serveCurrent(key, req, res) {
  if (key.split('/').some(p => p === '..' || p === '.' || p.includes('\\'))) { res.writeHead(400); res.end(); return }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return }
  const entry = sources.get(key)
  const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json' }
  // Pages also serves translations from its frontend package. build:check omits
  // public by design, so map that small, unmodified subtree explicitly.
  const target = entry ? path.resolve(root, entry.source)
    : key.startsWith('translations/') ? path.join(root, 'public', key) : path.join(build, key || 'index.html')
  try {
    const body = await fs.readFile(target)
    res.writeHead(200, { 'Content-Type': entry?.source_content_type || types[path.extname(target)] || 'application/octet-stream',
      'Content-Length': body.length, 'Cache-Control': 'no-store' })
    res.end(req.method === 'HEAD' ? undefined : body)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    res.writeHead(404); res.end()
  }
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1')
    const key = decodeURIComponent(url.pathname).slice(1)
    if (!keys.has(key)) return await serveCurrent(key, req, res)
    const response = await serveR2Resource({ request: new Request(url, { method: req.method, headers: req.headers }), env, prefix: key.split('/')[0] })
    await fs.appendFile(requestLog, JSON.stringify({ time: new Date().toISOString(), key, method: req.method, status: response.status,
      encoding: response.headers.get('Content-Encoding'), range: req.headers.range || null }) + '\n')
    res.writeHead(response.status, Object.fromEntries(response.headers))
    if (response.body) Readable.fromWeb(response.body).pipe(res)
    else res.end()
  } catch (error) { console.error(error); res.statusCode = 500; res.end('Canary error') }
})
const port = Number(process.env.SIDEM_CANARY_PORT || 5180)
server.listen(port, '127.0.0.1', () => console.log(`Current-source gzip canary: http://127.0.0.1:${port}, ${keys.size} keys`))
function close() { server.close() }
process.on('SIGINT', close)
process.on('SIGTERM', close)
