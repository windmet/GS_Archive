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
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.resolve(__dirname, 'dist')

// External asset roots (mirrors vite.config.js defaults)
const LIPSYNC_ROOT = process.env.SIDEM_LIPSYNC_ROOT || 'E:/BaiduNetdiskDownload/SideM/scripts/lipsyncdata/adxlip'
const AUDIO_ROOT = process.env.SIDEM_AUDIO_ROOT || 'E:/BaiduNetdiskDownload/SideM/GS_Res/Audio'

function addSeAliasCandidates(candidates, fileName) {
  if (!fileName.endsWith('.ogg')) return
  const cue = fileName.replace(/\.ogg$/, '')
  const aliases = []

  if (/^step_(walk|run)_(come|away)_conc_sneaker$/.test(cue)) {
    aliases.push(cue.replace(/^step_(walk|run)_(come|away)_conc_sneaker$/, 'group_step_$1_conc_sneaker'))
  }
  if (cue === 'step_walk_come_conc_boot' || cue === 'step_walk_away_conc_boot') {
    aliases.push('step_walk_come_conc_boot_hall', 'step_walk_come_conc_boot_slow')
  }

  for (const alias of aliases) {
    for (const dir of ['sfx', 'telephone', 'system']) {
      candidates.push(path.resolve(AUDIO_ROOT, dir, `${alias}.ogg`))
    }
  }
}

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

// ── Audio middleware ──
const AUDIO_DIRS = ['ambient', 'bgm', 'sfx', 'system', 'telephone']

function handleAudio(urlPath, res) {
  // urlPath: /se/cloth_move_ss01.ogg or /ambient/ambi_room.ogg
  const parts = urlPath.replace(/^\/+/, '').split('/')
  const type = parts[0]
  const fileName = parts.slice(1).join('/')
  if (!type || !fileName) return false

  const candidates = []
  if (type === 'se') {
    for (const dir of ['sfx', 'telephone', 'system']) {
      candidates.push(path.resolve(AUDIO_ROOT, dir, fileName))
    }
    addSeAliasCandidates(candidates, fileName)
  } else if (AUDIO_DIRS.includes(type)) {
    candidates.push(path.resolve(AUDIO_ROOT, type, fileName))
    if (type === 'ambient' && fileName.endsWith('_t.ogg')) {
      candidates.push(path.resolve(AUDIO_ROOT, type, fileName.replace(/_t\.ogg$/, '.ogg')))
    }
  } else {
    return false
  }

  const rootPath = path.resolve(AUDIO_ROOT)
  for (const fp of candidates) {
    if (!fp.startsWith(rootPath + path.sep)) continue
    if (serveFile(res, fp)) return true
  }
  return false
}

// ── Lipsync middleware ──
function handleLipsync(urlPath, res) {
  // urlPath: /scenario_1_1_001_01.json
  const rawUrl = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '')
  const filePath = path.resolve(LIPSYNC_ROOT, rawUrl)
  const rootPath = path.resolve(LIPSYNC_ROOT)
  if (!filePath.startsWith(rootPath + path.sep)) {
    res.statusCode = 403
    res.end('Forbidden')
    return true
  }
  if (serveFile(res, filePath)) return true
  return false
}

// ── Static file serving from dist/ ──
function handleStatic(urlPath, res) {
  // Normalise: strip query strings, decode, remove leading /
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\//, '')
  const relativePath = clean || 'index.html'
  let filePath = path.resolve(DIST_DIR, relativePath)

  const ext = path.extname(filePath).toLowerCase()
  const immutableAsset = clean.startsWith('assets/') && !['.html', '.json'].includes(ext)
  if (serveFile(res, filePath, immutableAsset ? 86400 : 0)) {
    return true
  }
  // SPA fallback: try index.html
  const indexHtml = path.resolve(DIST_DIR, 'index.html')
  if (serveFile(res, indexHtml)) return true
  return false
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

const { port, host } = parseArgs()

// Check dist exists
if (!fs.existsSync(DIST_DIR)) {
  console.error(`❌ dist/ directory not found at: ${DIST_DIR}`)
  console.error('   Run "npm run build" first.')
  process.exit(1)
}

const server = http.createServer((req, res) => {
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

  // Route: static files from dist/
  if (handleStatic(urlPath, res)) return

  // 404
  res.statusCode = 404
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.end('404 Not Found')
})

server.listen(port, host, () => {
  console.log(`🚀 SideM Story Viewer server running`)
  console.log(`   Local:   http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`)
  if (host === '0.0.0.0') {
    console.log(`   Network: http://<your-lan-ip>:${port}`)
  }
  console.log(`   Audio:   ${AUDIO_ROOT}`)
  console.log(`   Lipsync: ${LIPSYNC_ROOT}`)
  console.log(`   (Press Ctrl+C to stop)`)
})
