import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PUBLIC_ROUTES } from '../src/core/publicRoutes.js'
import { buildReceipt, checkStartupBudget, evaluateJourneys, manifestDigest, parsePackageArgs, productionGate,
  renderHeaders, renderRobots, renderSitemap, validateJourneyContract } from './lib/pages-package.mjs'

// Fixture-only contract for the one Pages packager (docs/RELEASE_CONTRACT.md): argument gate, startup budget
// single source, journeys receipt, indexing headers/robots/sitemap, and the route classes the release gate reads.
const root = fileURLToPath(new URL('..', import.meta.url))
const read = file => readFileSync(path.join(root, file), 'utf8')
const sha = text => createHash('sha256').update(text).digest('hex')
const R = 'a'.repeat(64), D = 'b'.repeat(64)
const base = ['--models', 'm', '--out', 'o', '--data-revision', R]

// 1. Arguments: production always needs the owner's words and exactly one of journeys / exception.
assert.equal(parsePackageArgs(['--target', 'preview', ...base]).origin, null)
const production = ['--target', 'production', ...base, '--origin', 'https://gs-archive.com', '--approval', '按例外发布', '--approval-date', '2026-11-09']
assert.equal(parsePackageArgs([...production, '--exception']).exception, true)
assert.equal(parsePackageArgs([...production, '--journeys', 'j.json']).journeysFile, 'j.json')
for (const [argv, pattern] of [
  [['--target', 'production', ...base, '--approval', 'x', '--approval-date', '2026-11-09', '--exception'], /requires --origin/],
  [production.filter((_, i) => i < production.indexOf('--approval') || i > production.indexOf('--approval') + 1).concat('--exception'), /requires --approval/],
  [production.slice(0, -2).concat('--exception'), /approval-date/],
  [production, /exactly one of --journeys/],
  [[...production, '--exception', '--journeys', 'j.json'], /exactly one of --journeys/],
  [['--target', 'preview', ...base, '--exception'], /production only/],
  [['--target', 'staging', ...base], /Usage/],
  [['--target', 'preview', ...base, '--origin', 'http://x.dev'], /https origin/],
]) assert.throws(() => parsePackageArgs(argv), pattern)

// 2. Startup budget: startup-policy.json is the only limit, and the audit must be built under it.
const policyText = read('readmodels/contracts/startup-policy.json'), limit = JSON.parse(policyText).initialJsGzipLimit
const budget = estimate => ({ policySha256: sha(policyText), initialJsGzipLimit: limit, initialJsGzipEstimate: estimate })
assert.equal(checkStartupBudget(budget(limit - 10), policyText).headroom, 10)
assert.throws(() => checkStartupBudget(budget(limit + 1), policyText), /exceeds/)
assert.throws(() => checkStartupBudget({ ...budget(1), policySha256: D }, policyText), /another/)
const packager = read('scripts/prepare-pages-package.mjs')
for (const call of ['parsePackageArgs(', 'checkStartupBudget(budget, await fs.readFile(path.join(root, STARTUP_POLICY)', 'evaluateJourneys(',
  'buildReceipt(', 'renderHeaders(', 'renderRobots(', 'renderSitemap(', "'--release' : '--progress'"])
  assert.ok(packager.includes(call), `the packager must call ${call}`)
assert.ok(read('scripts/prepare-readmodel-preview.mjs').split('\n').length < 8 &&
  read('scripts/prepare-readmodel-preview.mjs').includes("import('./prepare-pages-package.mjs')"), 'the old preview command only forwards')
const sources = []
const walk = dir => {
  for (const name of readdirSync(path.join(root, dir))) {
    const rel = `${dir}/${name}`
    if (['node_modules', 'fixtures'].includes(name)) continue
    if (statSync(path.join(root, rel)).isDirectory()) walk(rel)
    else if (/\.(mjs|js|yml)$/.test(name)) sources.push(rel)
  }
}
for (const dir of ['scripts', 'readmodels', '../.github/workflows']) walk(dir)
const hardLimits = sources.filter(file => file !== 'scripts/verify-release-package-contract.mjs').filter(file => {
  const text = read(file)
  return /initialJsGzip\w*\s*(<=|<|>=|>)\s*\(?\s*\d/.test(text) || /initialJsGzip[^\n]*\d+\s*\*\s*1024|\d+\s*\*\s*1024[^\n]*initialJsGzip/.test(text)
})
assert.deepEqual(hardLimits, [], 'a startup JS limit may only come from startup-policy.json')
for (const dir of ['readmodels/contracts', 'config']) for (const name of readdirSync(path.join(root, dir)).filter(name => name.endsWith('.json'))) {
  if (`${dir}/${name}` === 'readmodels/contracts/startup-policy.json') continue
  assert.doesNotMatch(read(`${dir}/${name}`), /"initialJsGzip(Limit|Estimate)"/, `${dir}/${name} must not carry a second startup limit`)
}

// 3. Journeys: one receipt per frozen source digest; every journey on every required device passes.
const contract = validateJourneyContract(JSON.parse(read('config/release-journeys.json')))
const required = contract.devices.filter(device => device.required)
assert.ok(required.length >= 3 && contract.journeys.length >= 8)
const rows = required.flatMap(device => contract.journeys.map(journey => ({ journey: journey.id, device: device.id, status: 'pass', browser: 'x' })))
const results = { schema_version: 1, kind: 'release-journeys', sourceDigest: D, reviewer: 'owner', checkedAt: '2026-11-09', results: rows }
assert.equal(evaluateJourneys(contract, results, D).accepted, true)
assert.throws(() => evaluateJourneys(contract, results, R), /source digest/)
assert.throws(() => evaluateJourneys(contract, { ...results, results: rows.slice(1) }, D), /missing/)
assert.throws(() => evaluateJourneys(contract, { ...results, results: rows.map((row, i) => i ? row : { ...row, status: 'fail' }) }, D), /failed/)

// 4. Indexing: only production drops noindex, publishes a sitemap and names its receipt.
const preview = renderHeaders({ target: 'preview', shellSections: ['cards'] })
const live = renderHeaders({ target: 'production', shellSections: ['cards'] })
assert.match(preview, /^\/\*\n  X-Robots-Tag: noindex, nofollow\n/)
assert.ok(preview.includes('/preview-receipt.json\n  Cache-Control: no-store') && preview.includes('/cards/*\n  Cache-Control: no-cache'))
assert.ok(!live.includes('X-Robots-Tag') && live.includes('/production-receipt.json\n  Cache-Control: no-store'))
assert.equal(renderRobots({ target: 'preview' }), 'User-agent: *\nDisallow: /\n')
assert.equal(renderRobots({ target: 'production', origin: 'https://gs-archive.com/' }), 'User-agent: *\nAllow: /\nSitemap: https://gs-archive.com/sitemap.xml\n')
const sitemap = renderSitemap({ origin: 'https://gs-archive.com', urls: ['https://gs-archive.com/cards/', 'https://gs-archive.com/cards/'] })
assert.equal((sitemap.match(/<loc>/g) || []).length, 2)
assert.ok(sitemap.includes('<loc>https://gs-archive.com/</loc>'))
assert.throws(() => renderSitemap({ origin: 'https://gs-archive.com', urls: ['https://preview.gs-archive.com/cards/'] }), /outside/)

// 5. Gate and receipt: public routes ready, then journeys or an exception (recorded with the owner's words).
assert.throws(() => productionGate({ publicRoutesReady: false, publicBlocking: [{ view: 'chibi_stage', reasons: ['data'] }], exception: true }), /chibi_stage/)
assert.equal(productionGate({ publicRoutesReady: true, exception: true }), 'user-authorized-production-exception')
assert.equal(productionGate({ publicRoutesReady: true, journeys: { accepted: true } }), 'production-release')
const receiptInput = { budget: { sourceRevision: 'c'.repeat(40), sourceDigest: D },
  acceptance: { routes: { publicRoutesReady: true, publicBlocking: [], unfinished: [] }, allPublicRoutesMigrated: false, deviceReviewAccepted: false },
  boot: { release: R }, dataRevision: R, compiledRevision: '', origin: 'https://gs-archive.com', translationRelease: { release: R, files: 1 },
  startup: { estimate: 1, limit: 2, policySha256: R }, seasonalCount: 306, entityShellCount: 1, generatedAt: '2026-11-09T00:00:00+08:00' }
const exceptional = buildReceipt({ ...receiptInput, target: 'production', approval: { statement: '按例外发布', date: '2026-11-09' }, exception: true })
assert.equal(exceptional.purpose, 'user-authorized-production-exception')
assert.equal(exceptional.exception.ownerStatement, '按例外发布')
assert.equal(exceptional.searchIndexing, 'allowed')
const devicePreview = buildReceipt({ ...receiptInput, target: 'preview' })
assert.equal(devicePreview.productionApproved, false)
assert.ok(!('approval' in devicePreview) && !('exception' in devicePreview) && devicePreview.searchIndexing === 'blocked')
assert.ok(!Object.values(exceptional).some(value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT.*Z$/.test(value)), 'no wall-clock timestamp in the receipt')
const a = manifestDigest([{ file: 'b', bytes: 1, sha256: R }, { file: 'a', bytes: 1, sha256: R }])
assert.equal(a.manifestSha256, manifestDigest([...a.manifest].reverse()).manifestSha256)

// 6. Route classes: a view with a public address can never be classed out of the release gate.
const ledger = JSON.parse(read('readmodels/contracts/routes.json'))
const classOf = new Map(ledger.routes.map(route => [route.view, route.class]))
for (const view of new Set(PUBLIC_ROUTES.map(route => route.view))) assert.equal(classOf.get(view), 'public', `${view} has a public address`)
assert.equal(classOf.get('experiments'), 'alias')
console.log(`Release package contract: ${contract.journeys.length} journeys x ${required.length} required devices; ${classOf.size} classed views; startup limit ${limit} B from startup-policy.json only`)
