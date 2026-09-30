import http from 'node:http'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createArchiveAssetResolver, isWithinRoot } from './lib/archive-assets.mjs'
import { isWithdrawnExternalStoryKey } from '../shared/deploy/ExternalStoryResourcePolicy.js'

// Local production-code QA: mount existing bytes, never copy the media corpus.
const root = fileURLToPath(new URL('..', import.meta.url))
const option = name => process.argv[process.argv.indexOf(name) + 1]
if (!process.argv.includes('--models')) throw Error('Supply --models <verified external candidate>')
const models = path.resolve(option('--models'))
const build = path.join(root, '.analysis/build-check')
const publicRoot = path.join(root, 'public')
const evidence = path.join(root, '.analysis/player-b002-repair')
const faults = process.argv.includes('--faults') ? path.resolve(option('--faults')) : null
if (faults && !isWithinRoot(evidence, faults)) throw Error('Fault file must be inside this QA evidence directory')
await fs.mkdir(evidence, { recursive: true })
const html = await fs.readFile(path.join(build, 'index.html'), 'utf8')
const embedded = html.match(/id="archive-bootstrap">([^<]*)<\/script>/)
const bootstrap = JSON.parse(await fs.readFile(path.join(models, 'bootstrap.inline.json'), 'utf8'))
if (!embedded || JSON.stringify(JSON.parse(embedded[1])) !== JSON.stringify(bootstrap)) throw Error('Build bootstrap differs from verified candidate')
const assets = createArchiveAssetResolver()
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' }
async function existing(candidates) {
  for (const file of candidates) try { if ((await fs.stat(file)).isFile()) return file } catch (error) { if (error.code !== 'ENOENT') throw error }
}
const server = http.createServer(async (req, res) => {
  const route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  let receipt = {}
  res.on('finish', () => { void fs.appendFile(path.join(evidence, 'http-requests.jsonl'), JSON.stringify({ at: new Date().toISOString(), url: req.url, status: res.statusCode, ...receipt }) + '\n') })
  try {
    if (!['GET', 'HEAD'].includes(req.method) || route.split('/').some(p => p === '..' || p.includes('\\'))) { res.writeHead(400); res.end(); return }
    if (isWithdrawnExternalStoryKey(route.slice(1))) { res.writeHead(410); res.end(); return }
    let fault
    if (faults) try { fault = JSON.parse(await fs.readFile(faults, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
    const rule = (fault?.rules || [fault]).find(item => item?.path === route && item.remaining > 0)
    if (rule) {
      rule.remaining--; await fs.writeFile(faults, JSON.stringify(fault))
      if (rule.status) { res.writeHead(rule.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end('{"expected_qa_fault":true}'); return }
      if (rule.bodyFile) {
        const file = path.resolve(evidence, rule.bodyFile)
        if (!isWithinRoot(evidence, file)) throw Error('Fault body outside QA directory')
        const body = await fs.readFile(file)
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(body); return
      }
      if (rule.delayMs) await new Promise(resolve => setTimeout(resolve, rule.delayMs))
    }
    const candidates = []
    if (route.startsWith('/_catalog/')) candidates.push(path.join(models, 'pages', route))
    else {
      candidates.push(path.join(build, route === '/' ? 'index.html' : route), path.join(publicRoot, route))
      if (route.startsWith('/assets/audio/')) candidates.push(...assets.audioCandidates(route.slice('/assets/audio/'.length)))
      if (route.startsWith('/assets/lipsync/adxlip/')) candidates.push(assets.lipsyncPath(route.slice('/assets/lipsync/adxlip/'.length)))
      if (route.startsWith('/assets/card-art/')) candidates.push(assets.cardArtPath(route.slice('/assets/card-art/'.length)))
    }
    const file = await existing(candidates.filter(Boolean))
    if (!file) { res.writeHead(404); res.end(); return }
    const body = await fs.readFile(file)
    receipt = { bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') }
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' }
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/)
    if (range) {
      const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1
      if (start > end || start >= body.length) { res.writeHead(416, { 'Content-Range': `bytes */${body.length}` }); res.end(); return }
      res.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${body.length}` })
      res.end(req.method === 'HEAD' ? undefined : body.subarray(start, end + 1))
    } else { res.writeHead(200, { ...headers, 'Content-Length': body.length }); res.end(req.method === 'HEAD' ? undefined : body) }
  } catch (error) { console.error(error); if (!res.headersSent) res.writeHead(500); res.end() }
})
const port = Number(process.argv.includes('--port') ? option('--port') : 5197)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid port')
server.listen(port, '127.0.0.1', () => console.log(`Player QA production code http://127.0.0.1:${port}/; release ${bootstrap.release}`))
