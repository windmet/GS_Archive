/**
 * Production server for SideM Story Viewer.
 *
 * Serves the built dist/ directory, plus proxying audio and lip-sync
 * data from external directories that live outside the repo.
 *
 * Usage:
 *   node server.js                    # port 5173
 *   node server.js --port 8080        # custom port
 *   node server.js --host 0.0.0.0     # LAN access
 */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createArchiveAssetResolver } from './scripts/lib/archive-assets.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.resolve(__dirname, 'dist')

// ── MIME types ──
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.skel': 'application/octet-stream',
  '.atlas': 'text/plain; charset=utf-8',
}

function mimeType(ext) {
  return MIME[ext] || 'application/octet-stream'
}

// ── Helper: serve a file with caching ──
function serveFile(res, filePath, maxAge = 0) {
  const ext = path.extname(filePath).toLowerCase()
  const stat = fs.statSync(filePath, { throwIfNoEntry: false })
  if (!stat || !stat.isFile()) return false

  res.statusCode = 200
  res.setHeader('Content-Type', mimeType(ext))
  if (maxAge > 0) {
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`)
  } else {
    res.setHeader('Cache-Control', 'no-store')
  }
  const stream = fs.createReadStream(filePath)
  stream.pipe(res)
  stream.on('error', () => { res.statusCode = 500; res.end() })
  return true
}

/** Construct without listening so callers can own the port and lifecycle. */
export function createArchiveServer({ distDir = DIST_DIR, assetResolver = createArchiveAssetResolver() } = {}) {
  function handleAudio(urlPath, res) {
    const clean = decodeURIComponent(urlPath.split('?')[0])
    for (const file of assetResolver.audioCandidates(clean)) {
      if (serveFile(res, file)) return true
    }
    return false
  }

  function handleLipsync(urlPath, res) {
    const file = assetResolver.lipsyncPath(decodeURIComponent(urlPath.split('?')[0]))
    if (!file) {
      res.statusCode = 403
      res.end('Forbidden')
      return true
    }
    return serveFile(res, file)
  }

  function handleCardArt(urlPath, res) {
    const file = assetResolver.cardArtPath(decodeURIComponent(urlPath.split('?')[0]))
    return file ? serveFile(res, file, 86400) : false
  }

  // ── Static file serving from dist/ ──
  function handleStatic(urlPath, res) {
    // Normalise: strip query strings, decode, remove leading /
    const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\//, '')
    const relativePath = clean || 'index.html'
    const filePath = path.resolve(distDir, relativePath)

    const ext = path.extname(filePath).toLowerCase()
    const immutableAsset = clean.startsWith('assets/') && !['.html', '.json'].includes(ext)
    if (serveFile(res, filePath, immutableAsset ? 86400 : 0)) {
      return true
    }
    // SPA fallback: try index.html
    const indexHtml = path.resolve(distDir, 'index.html')
    if (serveFile(res, indexHtml)) return true
    return false
  }

  return http.createServer((req, res) => {
    const urlPath = req.url || '/'

    // Route: lipsync
    if (urlPath.startsWith('/assets/lipsync/adxlip/')) {
      const subPath = urlPath.replace('/assets/lipsync/adxlip', '')
      if (handleLipsync(subPath, res)) return
    }

    // Route: audio
    if (urlPath.startsWith('/assets/audio/')) {
      const subPath = urlPath.replace('/assets/audio', '')
      if (handleAudio(subPath, res)) return
    }

    if (urlPath.startsWith('/assets/card-art/')) {
      const subPath = urlPath.replace('/assets/card-art', '')
      if (handleCardArt(subPath, res)) return
    }

    // Route: static files from dist/
    if (handleStatic(urlPath, res)) return

    // 404
    res.statusCode = 404
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('404 Not Found')
  })
}

// ── Server ──
function parseArgs() {
  const args = { port: 5173, host: '127.0.0.1' }
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--port') args.port = parseInt(process.argv[++i], 10) || args.port
    if (process.argv[i] === '--host') args.host = process.argv[++i] || args.host
  }
  return args
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const { port, host } = parseArgs()
  const assetResolver = createArchiveAssetResolver()
  const server = createArchiveServer({ assetResolver })

  // Check dist exists
  if (!fs.existsSync(DIST_DIR)) {
    console.error(`❌ dist/ directory not found at: ${DIST_DIR}`)
    console.error('   Run "npm run build" first.')
    process.exit(1)
  }

  server.listen(port, host, () => {
    console.log(`🚀 SideM Story Viewer server running`)
    console.log(`   Local:   http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`)
    if (host === '0.0.0.0') {
      console.log(`   Network: http://<your-lan-ip>:${port}`)
    }
    console.log(`   Audio:   ${assetResolver.roots.audio}`)
    console.log(`   Lipsync: ${assetResolver.roots.lipsync}`)
    console.log(`   Card art: ${assetResolver.roots.cardArt}`)
    console.log(`   (Press Ctrl+C to stop)`)
  })
}
