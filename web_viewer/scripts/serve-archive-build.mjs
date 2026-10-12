// Local production-bundle server: serves a code-only build (npm run build:check output, or any dist) with the
// corpus mapped in place, so the production bundle can be browsed and measured without copying public/.
//   node scripts/serve-archive-build.mjs [--dist=.analysis/build-check] [--catalog=<read-model candidate>] [--port=5181]
// /_catalog/* -> <candidate>/pages/_catalog, /assets /data /translations -> public/, everything else -> dist,
// with Cloudflare-Pages-like resolution: /x/ -> /x/index.html, /x -> 308 /x/ when that directory index exists,
// unknown paths -> /index.html (SPA fallback). Local verification only; not a deployment.
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const option = (name, fallback) => process.argv.slice(2).find(arg => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback
const dist = path.resolve(root, option('dist', '.analysis/build-check'))
const catalog = path.resolve(option('catalog', process.env.SIDEM_READMODEL_CANDIDATE || 'E:/GS_readmodels_candidate_20261012_age'), 'pages')
const port = Number(option('port', '5181'))
const publicDir = path.join(root, 'public')
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
  '.atlas': 'text/plain', '.skel': 'application/octet-stream', '.txt': 'text/plain' }

for (const dir of [dist, catalog]) if (!existsSync(dir)) throw new Error(`Missing ${dir}`)

function inside(base, relative) {
  const file = path.resolve(base, '.' + relative)
  return file === base || file.startsWith(base + path.sep) ? file : null
}
const isFile = file => { try { return statSync(file).isFile() } catch { return false } }
const isDir = file => { try { return statSync(file).isDirectory() } catch { return false } }

const misses = new Map()
createServer((req, res) => {
  let pathname
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname) } catch { res.writeHead(400).end(); return }
  const mapped = pathname.startsWith('/_catalog/') ? inside(catalog, pathname)
    : /^\/(assets|data|translations)\//.test(pathname) ? inside(publicDir, pathname)
      : inside(dist, pathname)
  let file = mapped
  if (file && isDir(file)) {
    if (!pathname.endsWith('/') && isFile(path.join(file, 'index.html'))) { res.writeHead(308, { Location: pathname + '/' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '') }).end(); return }
    file = path.join(file, 'index.html')
  }
  const corpus = /^\/(_catalog|assets|data|translations)\//.test(pathname)
  if (!file || !isFile(file)) {
    if (corpus) { misses.set(pathname, (misses.get(pathname) || 0) + 1); res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return }
    file = path.join(dist, 'index.html')
  }
  const headers = { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': file.endsWith('.html') ? 'no-cache' : pathname.startsWith('/_app/') || pathname.startsWith('/_catalog/v/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600' }
  res.writeHead(200, headers)
  if (req.method === 'HEAD') { res.end(); return }
  createReadStream(file).pipe(res)
}).listen(port, '127.0.0.1', () => console.log(`Serving ${path.relative(root, dist) || dist} with corpus mapping on http://127.0.0.1:${port}/ (catalog ${catalog})`))

process.on('SIGINT', () => {
  if (misses.size) console.log(`Corpus misses: ${[...misses.keys()].slice(0, 20).join(', ')}${misses.size > 20 ? ' …' : ''}`)
  process.exit(0)
})
