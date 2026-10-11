import fs, { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const checkedInBootstrap = fileURLToPath(new URL('../../readmodels/bootstrap.inline.json', import.meta.url))

// Dev only: SIDEM_READMODEL_CANDIDATE points at a local build_readmodels output
// (outside the checkout). The dev server then inlines that candidate's bootstrap and
// serves its /_catalog files, so read-model pages work locally. Builds never use it.
function candidateRoot() {
  const root = process.env.SIDEM_READMODEL_CANDIDATE
  if (!root) return null
  const resolved = path.resolve(root)
  if (!fs.existsSync(path.join(resolved, 'bootstrap.inline.json')) || !fs.existsSync(path.join(resolved, 'pages', '_catalog'))) {
    throw new Error(`SIDEM_READMODEL_CANDIDATE is not a build_readmodels output: ${resolved}`)
  }
  return resolved
}

export function archiveBootstrapPlugin() {
  let candidate = null
  return {
    name: 'archive-bootstrap',
    configResolved(config) { candidate = config.command === 'serve' ? candidateRoot() : null },
    configureServer(server) {
      if (!candidate) return
      const catalog = path.join(candidate, 'pages', '_catalog')
      server.config.logger.info(`  read-model candidate: ${candidate}`)
      server.middlewares.use('/_catalog', (req, res, next) => {
        const relative = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        const file = path.resolve(catalog, relative)
        if (!file.startsWith(catalog + path.sep) || !file.endsWith('.json') || !fs.existsSync(file)) return next()
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
      return html.replace('</head>', `<script type="application/json" id="archive-bootstrap">${inline}</script>\n</head>`)
    },
  }
}
