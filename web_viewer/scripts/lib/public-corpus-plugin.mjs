import fs from 'node:fs'
import path from 'node:path'

// Dev only. Git ignores most of public/assets and public/data (the corpus), so a linked worktree has the tracked
// files only. A request this checkout's public/ cannot answer is served from the configured corpus (publish_root of
// archive_sources.local.json, i.e. the main checkout's public/); tracked files in the worktree still win. A file in
// neither is a 404, as on Pages, instead of Vite's index.html fallback with status 200.
const CORPUS_PREFIXES = ['/assets/', '/data/']
const TYPES = {
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8',
  '.atlas': 'text/plain; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
}

function isFile(file) {
  try { return fs.statSync(file).isFile() } catch { return false }
}

function send(req, res, file) {
  const size = fs.statSync(file).size
  res.setHeader('Content-Type', TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Accept-Ranges', 'bytes')
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '')
  let start = 0, end = size - 1
  if (range && (range[1] || range[2])) {
    start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
    end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
    if (start > end || start >= size) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` })
      return res.end()
    }
    res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 })
  } else {
    res.writeHead(200, { 'Content-Length': size })
  }
  if (req.method === 'HEAD') return res.end()
  fs.createReadStream(file, { start, end }).pipe(res)
}

// corpusPublic: the full corpus; Vite's own publicDir is this checkout's (the same folder disables the fallback).
export function publicCorpusPlugin({ corpusPublic }) {
  let local = null
  let corpus = null
  return {
    name: 'sidem-public-corpus',
    apply: 'serve',
    configResolved(config) {
      local = path.resolve(config.publicDir)
      corpus = corpusPublic && path.resolve(corpusPublic) !== local && fs.existsSync(corpusPublic) ? path.resolve(corpusPublic) : null
    },
    configureServer(server) {
      if (corpus) server.config.logger.info(`  public corpus fallback: ${corpus}`)
      server.middlewares.use((req, res, next) => {
        if (!['GET', 'HEAD'].includes(req.method)) return next()
        let pathname
        try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname) } catch { return next() }
        if (!CORPUS_PREFIXES.some(prefix => pathname.startsWith(prefix))) return next()
        // An encoded backslash survives URL parsing and is a separator on Windows; nothing may leave public/.
        const relative = path.normalize(pathname.slice(1))
        if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return next()
        if (isFile(path.join(local, relative))) return next()
        const shared = corpus && path.join(corpus, relative)
        if (shared && isFile(shared)) return send(req, res, shared)
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
        res.end(req.method === 'HEAD' ? undefined : `Not in public/${corpus ? ' or the corpus' : ''}: ${pathname}`)
      })
    },
  }
}
