// A linked worktree serves the whole corpus without copying it: the dev server falls back to the main checkout's
// public/ for files git ignores, reads the main checkout's local source config, and picks the read-model candidate
// whose release is the checked-in one. Missing files are 404s, not Vite's index.html with status 200.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { localConfigPath, mainCheckoutRoot } from './lib/archive-sources.mjs'
import { matchingCandidate } from './lib/archive-bootstrap-plugin.mjs'
import { publicCorpusPlugin } from './lib/public-corpus-plugin.mjs'

const tmp = mkdtempSync(path.join(os.tmpdir(), 'sidem-worktree-corpus-'))
const put = (file, text = '') => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, text) }

function serve(plugin, publicDir) {
  let handler
  plugin.configResolved({ publicDir })
  plugin.configureServer({ config: { logger: { info() {} } }, middlewares: { use: fn => { handler = fn } } })
  return (url, headers = {}) => new Promise(resolve => {
    const chunks = []
    const res = {
      statusCode: 200, headers: {},
      setHeader(key, value) { this.headers[key.toLowerCase()] = value },
      writeHead(status, extra = {}) { this.statusCode = status; for (const [k, v] of Object.entries(extra)) this.headers[k.toLowerCase()] = v },
      write(chunk) { chunks.push(Buffer.from(chunk)) },
      end(chunk) { if (chunk) chunks.push(Buffer.from(chunk)); resolve({ status: this.statusCode, headers: this.headers, body: Buffer.concat(chunks).toString() }) },
      on() { return this }, once() { return this }, emit() { return true },
    }
    // fs streams pipe into res: write/end are enough.
    res.removeListener = () => res
    handler({ method: 'GET', url, headers }, res, () => resolve({ next: true }))
  })
}

try {
  // Git layout: <main>/.git/worktrees/<name> is the worktree's gitdir; the main checkout's .git is a folder.
  const main = path.join(tmp, 'main'), wt = path.join(tmp, 'wt')
  mkdirSync(path.join(main, '.git', 'worktrees', 'wt'), { recursive: true })
  put(path.join(wt, '.git'), `gitdir: ${path.join(main, '.git', 'worktrees', 'wt')}\n`)
  assert.equal(mainCheckoutRoot(wt), main, 'a worktree finds its main checkout')
  assert.equal(mainCheckoutRoot(main), null, 'the main checkout has none')
  assert.equal(mainCheckoutRoot(path.join(tmp, 'nogit')), null, 'no .git, no main checkout')

  // Local config: the worktree's own wins, else the main checkout's, else none (the example).
  const mainConfig = path.join(main, 'web_viewer', 'config', 'archive_sources.local.json')
  assert.equal(localConfigPath(path.join(wt, 'web_viewer')), null)
  put(mainConfig, '{}')
  assert.equal(localConfigPath(path.join(wt, 'web_viewer')), mainConfig, 'a worktree reads the main checkout config')
  const ownConfig = path.join(wt, 'web_viewer', 'config', 'archive_sources.local.json')
  put(ownConfig, '{}')
  assert.equal(localConfigPath(path.join(wt, 'web_viewer')), ownConfig, 'its own config wins')

  // Corpus fallback: tracked files in the worktree win, ignored ones come from the corpus, the rest are 404s.
  const local = path.join(wt, 'web_viewer', 'public'), corpus = path.join(main, 'web_viewer', 'public')
  put(path.join(local, 'assets', 'own.png'), 'worktree')
  put(path.join(corpus, 'assets', 'own.png'), 'corpus')
  put(path.join(corpus, 'assets', 'cards', 'icon.png'), '0123456789')
  put(path.join(corpus, 'data', 'compiled', 'a.json'), '{"a":1}')
  put(path.join(main, 'secret.txt'), 'secret')  // reachable only by climbing out of the corpus
  const get = serve(publicCorpusPlugin({ corpusPublic: corpus }), local)
  assert.deepEqual(await get('/assets/own.png'), { next: true }, 'a worktree file is left to Vite')
  const icon = await get('/assets/cards/icon.png?v=1')
  assert.equal(icon.status, 200); assert.equal(icon.body, '0123456789'); assert.equal(icon.headers['content-type'], 'image/png')
  assert.equal((await get('/data/compiled/a.json')).headers['content-type'], 'application/json; charset=utf-8')
  const part = await get('/assets/cards/icon.png', { range: 'bytes=2-4' })
  assert.equal(part.status, 206); assert.equal(part.body, '234'); assert.equal(part.headers['content-range'], 'bytes 2-4/10')
  assert.equal((await get('/assets/cards/icon.png', { range: 'bytes=20-' })).status, 416)
  assert.equal((await get('/assets/cards/missing.png')).status, 404, 'missing in both is a 404, not index.html')
  assert.deepEqual(await get('/src/main.js'), { next: true }, 'only /assets and /data are corpus mounts')
  // URL parsing folds %2e%2e, but an encoded backslash survives it and is a separator on Windows.
  const escape = path.sep === '\\' ? '/assets/..%5c..%5c..%5csecret.txt' : '/assets/%2e%2e/%2e%2e/%2e%2e/secret.txt'
  const escaped = await get(escape)
  assert.ok(escaped.next || escaped.status === 404, 'no path escapes public/')
  assert.ok(!String(escaped.body || '').includes('secret'))
  // Without a separate corpus (the main checkout itself) nothing is borrowed, and misses are still 404s.
  const self = serve(publicCorpusPlugin({ corpusPublic: local }), local)
  assert.equal((await self('/assets/cards/icon.png')).status, 404)

  // Read-model candidates: the folder whose bootstrap release is the checked-in one.
  const candidates = path.join(tmp, 'candidates')
  for (const [name, release] of [['rm-old', 'a'.repeat(64)], ['rm-new', 'b'.repeat(64)], ['rm-broken', 'b'.repeat(64)]]) {
    put(path.join(candidates, name, 'bootstrap.inline.json'), JSON.stringify({ release }))
    if (name !== 'rm-broken') mkdirSync(path.join(candidates, name, 'pages', '_catalog'), { recursive: true })
  }
  assert.equal(matchingCandidate(candidates, 'b'.repeat(64)), path.join(candidates, 'rm-new'), 'the matching release, with a catalogue')
  assert.equal(matchingCandidate(candidates, 'c'.repeat(64)), null)
  assert.equal(matchingCandidate(null, 'b'.repeat(64)), null)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
console.log('Worktree corpus: main-checkout config, public corpus fallback with 404s and ranges, release-matched read-model candidate')
