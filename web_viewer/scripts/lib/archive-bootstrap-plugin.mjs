import fs, { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadArchiveSources } from './archive-sources.mjs'

const checkedInBootstrap = fileURLToPath(new URL('../../readmodels/bootstrap.inline.json', import.meta.url))

// Dev only: SIDEM_READMODEL_CANDIDATE points at a local build_readmodels output
// (outside the checkout). The dev server then inlines that candidate's bootstrap and
// serves its /_catalog files, so read-model pages work locally. Builds never use it.
// Without it, the dev server picks the output under readmodel_candidates_root (archive_sources.local.json)
// whose release is the checked-in one, so a fresh checkout or worktree needs no setup.
function isCandidate(root) {
  return fs.existsSync(path.join(root, 'bootstrap.inline.json')) && fs.existsSync(path.join(root, 'pages', '_catalog'))
}

function releaseOf(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')).release || '' } catch { return '' }
}

export function matchingCandidate(candidatesRoot, release) {
  if (!candidatesRoot || !release || !fs.existsSync(candidatesRoot)) return null
  return fs.readdirSync(candidatesRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(candidatesRoot, entry.name))
    .find(root => isCandidate(root) && releaseOf(path.join(root, 'bootstrap.inline.json')) === release) || null
}

export function candidateRoot(logger) {
  const root = process.env.SIDEM_READMODEL_CANDIDATE
  if (root) {
    const resolved = path.resolve(root)
    if (!isCandidate(resolved)) throw new Error(`SIDEM_READMODEL_CANDIDATE is not a build_readmodels output: ${resolved}`)
    return resolved
  }
  const release = releaseOf(checkedInBootstrap)
  let candidatesRoot = null
  try { candidatesRoot = loadArchiveSources().readmodelCandidatesRoot } catch {}
  const found = matchingCandidate(candidatesRoot, release)
  if (!found) logger?.warn(`  no read-model candidate for release ${release.slice(0, 8)} under ${candidatesRoot || '(readmodel_candidates_root unset)'}; read-model pages will 404`)
  return found
}

export function archiveBootstrapPlugin() {
  let candidate = null
  return {
    name: 'archive-bootstrap',
    configResolved(config) { candidate = config.command === 'serve' ? candidateRoot(config.logger) : null },
    configureServer(server) {
      const catalog = candidate && path.join(candidate, 'pages', '_catalog')
      if (candidate) server.config.logger.info(`  read-model candidate: ${candidate}`)
      // A catalogue file the candidate lacks is a 404, not Vite's index.html fallback ("Expected JSON").
      server.middlewares.use('/_catalog', (req, res) => {
        const relative = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        const file = catalog && path.resolve(catalog, relative)
        if (!file || !file.startsWith(catalog + path.sep) || !file.endsWith('.json') || !fs.existsSync(file)) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
          return res.end(candidate ? `Not in read-model candidate: /_catalog/${relative}` : 'No read-model candidate for this release')
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        fs.createReadStream(file).pipe(res)
      })
    },
    transformIndexHtml(html) {
      const bootstrapPath = candidate ? path.join(candidate, 'bootstrap.inline.json') : checkedInBootstrap
      const boot = JSON.parse(readFileSync(bootstrapPath, 'utf8'))
      if (boot.schema_version !== 1 || boot.read_model_version !== 1 || !/^[a-f0-9]{64}$/.test(boot.release || '')) {
        throw new Error('Invalid checked-in archive bootstrap')
      }
      if (!html.includes('</head>') || html.includes('id="archive-bootstrap"')) {
        throw new Error('Cannot insert archive bootstrap into HTML')
      }
      const inline = JSON.stringify(boot).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
      // The Portal (the first visit's landing page) reads its index before it knows which scope file to
      // load; preloading the index overlaps that round trip with the entry script's download. The URL is
      // release-pinned, and the read-model client's fetch (cors, same-origin credentials) matches the preload.
      const portal = boot.domains?.portal?.url
      if (!new RegExp(`^/_catalog/v/${boot.release}/portal/index\\.json$`).test(portal || '')) throw new Error('Archive bootstrap lacks the pinned portal index')
      return html.replace('</head>', `<script type="application/json" id="archive-bootstrap">${inline}</script>\n<link rel="preload" href="${portal}" as="fetch" crossorigin>\n</head>`)
    },
  }
}
