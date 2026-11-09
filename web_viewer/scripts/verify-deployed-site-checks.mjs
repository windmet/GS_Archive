import assert from 'node:assert/strict'
import { createPackageFetcher, parseHeadersFile, runSiteChecks } from './lib/deployed-site-checks.mjs'
import { renderHeaders, renderRobots, renderSitemap } from './lib/pages-package.mjs'

// Fixture-only checks for scripts/verify-deployed-site.mjs: a production package served with Pages semantics must
// pass, and each defect the 11-09 audit found on the live site (noindex, HTML robots.txt, canonical at another or
// unreachable origin, HTML for an entry chunk, receipt drift) must fail its own row.
const ORIGIN = 'https://gs-archive.test', R = 'a'.repeat(64)
const boot = { release: R, idols: [{ id: '001tom' }], domains: { cards: { url: `/_catalog/v/${R}/cards/index.json` } } }
const shell = location => `<!doctype html><html><head><link rel="canonical" href="${ORIGIN}${location}" /></head><body><script type="application/json" id="archive-bootstrap">${JSON.stringify(boot)}</script><script type="module" crossorigin src="/_app/index-x.js"></script></body></html>`
const receipt = { target: 'production', productionApproved: true, siteOrigin: ORIGIN, entityHeadShellOrigin: ORIGIN, sourceRevision: 'c'.repeat(40), release: R }
const manifest = [{ file: 'cards/index.html' }, { file: 'idols/001tom/index.html' }]
function site(overrides = {}) {
  const files = new Map(Object.entries({
    'index.html': shell('/'), 'cards/index.html': shell('/cards/'), 'idols/001tom/index.html': shell('/idols/001tom/'),
    '_app/index-x.js': 'export {}', '_catalog/bootstrap.json': JSON.stringify(boot), [`_catalog/v/${R}/cards/index.json`]: '{}',
    'production-receipt.json': JSON.stringify(receipt), 'robots.txt': renderRobots({ target: 'production', origin: ORIGIN }),
    'sitemap.xml': renderSitemap({ origin: ORIGIN, urls: [`${ORIGIN}/cards/`] }), '_headers': renderHeaders({ target: 'production', shellSections: ['cards', 'idols'] }),
    ...overrides,
  }))
  return createPackageFetcher(name => files.has(name) && files.get(name) !== null ? Buffer.from(files.get(name)) : null)
}
const reachable = async () => ({ reachable: true, detail: 'ok' })
const status = (result, id) => result.rows.find(row => row.id === id)?.status
const run = (overrides, more = {}) => runSiteChecks({ get: site(overrides), probeOrigin: reachable, packageInfo: { receipt, manifest }, ...more })

const good = await run({})
assert.deepEqual(good.rows.filter(row => row.status === 'fail'), [], 'a correct production package passes')
assert.equal(status(good, 'missing-chunk'), 'warn', 'Pages SPA fallback answers missing chunks with HTML: recorded, not failed')
assert.equal(status(good, 'r2-samples'), 'skip')
assert.equal(status(good, 'sitemap'), 'pass')

const preview = await runSiteChecks({ get: site({ 'production-receipt.json': null, 'preview-receipt.json': JSON.stringify({ ...receipt, target: 'preview', productionApproved: false }),
  '_headers': renderHeaders({ target: 'preview', shellSections: [] }), 'robots.txt': renderRobots({ target: 'preview' }) }), probeOrigin: reachable })
assert.deepEqual(preview.rows.filter(row => row.status === 'fail'), [], 'a correct preview passes (noindex + Disallow)')

assert.equal(status(await run({ '_headers': renderHeaders({ target: 'preview', shellSections: [] }) }), 'indexing-header'), 'fail', 'noindex on production')
assert.equal(status(await run({ 'robots.txt': null }), 'robots'), 'fail', 'robots.txt answered by the SPA fallback')
assert.equal(status(await run({ 'robots.txt': renderRobots({ target: 'preview' }) }), 'robots'), 'fail', 'production robots must allow')
assert.equal(status(await run({ 'cards/index.html': shell('/cards/').replace(ORIGIN, 'https://other.test') }), 'canonical'), 'fail', 'canonical at another origin')
assert.equal(status(await run({}, { probeOrigin: async () => ({ reachable: false, detail: 'DNS has no A/CNAME record' }) }), 'site-origin'), 'fail', 'canonical origin that does not resolve')
assert.equal(status(await run({ '_app/index-x.js': null }), 'entry-chunks'), 'fail', 'entry chunk answered with HTML')
assert.equal(status(await run({ '_catalog/bootstrap.json': JSON.stringify({ ...boot, release: 'f'.repeat(64) }) }), 'catalog-bootstrap'), 'fail', 'catalog of another release')
assert.equal(status(await run({}, { packageInfo: { receipt: { ...receipt, sourceRevision: 'd'.repeat(40) }, manifest } }), 'receipt'), 'fail', 'receipt drift from the package')
assert.equal(status(await run({ 'sitemap.xml': renderSitemap({ origin: 'https://other.test', urls: [] }) }), 'sitemap'), 'fail', 'sitemap for another origin')
const notFound = async request => request.startsWith('/_app/__gs-missing') ? { status: 404, type: 'text/plain', headers: {}, body: Buffer.alloc(0) } : site()(request)
assert.equal(status(await runSiteChecks({ get: notFound, probeOrigin: reachable }), 'missing-chunk'), 'pass')
assert.deepEqual(parseHeadersFile('/*\n  X-Robots-Tag: noindex\n/a\n  B: c\n'), [{ pattern: '/*', headers: { 'x-robots-tag': 'noindex' } }, { pattern: '/a', headers: { b: 'c' } }])
console.log(`Deployed-site checks: ${good.rows.length} rows; production and preview fixtures pass, 10 defect fixtures fail their row`)
