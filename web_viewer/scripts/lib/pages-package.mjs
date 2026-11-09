import { createHash } from 'node:crypto'

// Decisions of scripts/prepare-pages-package.mjs, kept pure so scripts/verify-release-package-contract.mjs
// tests exactly what the packager executes. The rules themselves are written up in docs/RELEASE_CONTRACT.md.
export const PACKAGE_TARGETS = Object.freeze(['preview', 'production'])
export const PAGES_PROJECT = 'gs-archive-preview'
export const BRANCH_BY_TARGET = Object.freeze({ preview: 'gs-architecture-device-test', production: 'master' })
export const RECEIPT_BY_TARGET = Object.freeze({ preview: 'preview-receipt.json', production: 'production-receipt.json' })
export const STARTUP_POLICY = 'readmodels/contracts/startup-policy.json'

const sha256 = value => createHash('sha256').update(value).digest('hex')
const check = (condition, message) => { if (!condition) throw new Error(message) }
const REVISION = /^[a-f0-9]{64}$/
const VALUED = ['--target', '--models', '--out', '--data-revision', '--compiled-revision', '--origin',
  '--approval', '--approval-date', '--journeys']
const FLAGS = ['--exception']

export function normalizeOrigin(value) {
  const origin = String(value || '').replace(/\/$/, '')
  check(/^https:\/\/[a-z0-9.-]+$/.test(origin), '--origin must be an https origin without a path')
  return origin
}

// Production always carries the owner's own words (GIT_WORKFLOW rule 6). The journeys receipt is the
// normal route; --exception records that those words also waive it, instead of a hand-edited package.
export function parsePackageArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]
    check(VALUED.includes(key) || FLAGS.includes(key), `Unknown argument: ${key}`)
    check(!Object.hasOwn(args, key), `Duplicate argument: ${key}`)
    if (FLAGS.includes(key)) { args[key] = true; continue }
    check(argv[i + 1] !== undefined && !argv[i + 1].startsWith('--'), `Missing value: ${key}`)
    args[key] = argv[++i]
  }
  const target = args['--target']
  check(PACKAGE_TARGETS.includes(target), 'Usage: --target preview|production --models <verified candidate> --out <new package directory> --data-revision <R2 data snapshot> [--compiled-revision <R2 compiled snapshot>] [--origin https://<site>] [production: --approval "<owner statement>" --approval-date YYYY-MM-DD (--journeys <results.json> | --exception)]')
  check(args['--models'] && args['--out'], 'Supply --models and --out')
  check(REVISION.test(args['--data-revision'] || ''), 'Invalid --data-revision')
  check(args['--compiled-revision'] === undefined || REVISION.test(args['--compiled-revision']), 'Invalid --compiled-revision')
  const origin = args['--origin'] === undefined ? null : normalizeOrigin(args['--origin'])
  const approval = args['--approval']?.trim() || null
  if (target === 'production') {
    check(origin, 'Production requires --origin: the site its canonical, og:url and sitemap point at')
    check(approval, 'Production requires --approval "<the owner\'s own words authorizing this release>"')
    check(/^\d{4}-\d{2}-\d{2}$/.test(args['--approval-date'] || ''), 'Production requires --approval-date YYYY-MM-DD')
    check(Boolean(args['--journeys']) !== Boolean(args['--exception']),
      'Production requires exactly one of --journeys <results for this source digest> or --exception (the approval also waives the journeys)')
  } else {
    check(!approval && !args['--approval-date'] && !args['--journeys'] && !args['--exception'],
      '--approval, --approval-date, --journeys and --exception apply to production only')
  }
  return { target, models: args['--models'], out: args['--out'], dataRevision: args['--data-revision'],
    compiledRevision: args['--compiled-revision'] || '', origin,
    approval: approval && { statement: approval, date: args['--approval-date'] },
    journeysFile: args['--journeys'] || null, exception: Boolean(args['--exception']) }
}

// The only startup JS limit is startup-policy.json; the build audit records the policy it was built under.
export function checkStartupBudget(budget, policyText) {
  const policy = JSON.parse(policyText)
  const limit = policy.initialJsGzipLimit
  check(Number.isSafeInteger(limit) && limit > 0, `${STARTUP_POLICY} lacks initialJsGzipLimit`)
  check(budget.policySha256 === sha256(policyText), `Build audit was made under another ${STARTUP_POLICY}; rerun npm run build:check`)
  check(budget.initialJsGzipLimit === limit, 'Build audit limit disagrees with the startup policy')
  const estimate = budget.initialJsGzipEstimate
  check(Number.isSafeInteger(estimate) && estimate > 0, 'Build audit lacks a startup JS estimate')
  check(estimate <= limit, `Startup JS ${estimate} B exceeds ${STARTUP_POLICY} initialJsGzipLimit ${limit} B`)
  return { estimate, limit, headroom: limit - estimate, policySha256: budget.policySha256 }
}

export function validateJourneyContract(contract) {
  check(contract?.schema_version === 1, 'config/release-journeys.json: expected schema_version 1')
  check(Array.isArray(contract.devices) && Array.isArray(contract.journeys), 'config/release-journeys.json: devices and journeys required')
  const ids = list => list.map(item => item.id)
  for (const [name, list] of [['device', contract.devices], ['journey', contract.journeys]]) {
    check(list.length && list.every(item => /^[a-z0-9-]+$/.test(item.id || '')), `release-journeys: every ${name} needs an id`)
    check(new Set(ids(list)).size === list.length, `release-journeys: duplicate ${name} id`)
  }
  check(contract.devices.some(device => device.required === true), 'release-journeys: at least one required device')
  for (const journey of contract.journeys) {
    check(journey.title && Array.isArray(journey.steps) && journey.steps.length && typeof journey.pass === 'string' && journey.pass.length > 10,
      `release-journeys: ${journey.id} needs title, steps and a pass rule`)
  }
  return contract
}

// A journeys receipt is evidence for one frozen source digest; every journey on every required device must pass.
export function evaluateJourneys(contract, results, sourceDigest) {
  validateJourneyContract(contract)
  check(results?.schema_version === 1 && results.kind === 'release-journeys', 'Journey results: expected kind release-journeys, schema_version 1')
  check(REVISION.test(sourceDigest || ''), 'Journey evaluation needs the build source digest')
  check(results.sourceDigest === sourceDigest, `Journey results are for source digest ${results.sourceDigest}, not this build's ${sourceDigest}`)
  check(results.reviewer && results.checkedAt && Array.isArray(results.results), 'Journey results need reviewer, checkedAt and results')
  const outcome = new Map(results.results.map(row => [`${row.journey}@${row.device}`, row]))
  const missing = [], failed = []
  for (const device of contract.devices.filter(device => device.required)) for (const journey of contract.journeys) {
    const row = outcome.get(`${journey.id}@${device.id}`)
    if (!row) missing.push(`${journey.id}@${device.id}`)
    else if (row.status !== 'pass' || !row.browser) failed.push(`${journey.id}@${device.id}`)
  }
  check(!missing.length && !failed.length, `Release journeys not accepted: missing ${missing.join(', ') || 'none'}; failed ${failed.join(', ') || 'none'}`)
  return { accepted: true, sourceDigest, reviewer: results.reviewer, checkedAt: results.checkedAt,
    journeys: contract.journeys.length, devices: contract.devices.filter(device => device.required).map(device => device.id) }
}

export function renderHeaders({ target, shellSections }) {
  check(PACKAGE_TARGETS.includes(target), `Unknown target: ${target}`)
  const noindex = target === 'preview' ? '/*\n  X-Robots-Tag: noindex, nofollow\n' : ''
  return `${noindex}/_app/*
  Cache-Control: public, max-age=31536000, immutable
/_catalog/v/*
  Cache-Control: public, max-age=31536000, immutable
/_catalog/bootstrap.json
  Cache-Control: no-cache
/${RECEIPT_BY_TARGET[target]}
  Cache-Control: no-store
/index.html
  Cache-Control: no-cache
${shellSections.map(section => `/${section}/*
  Cache-Control: no-cache
`).join('')}`
}

export function renderRobots({ target, origin }) {
  if (target === 'preview') return 'User-agent: *\nDisallow: /\n'
  return `User-agent: *\nAllow: /\nSitemap: ${normalizeOrigin(origin)}/sitemap.xml\n`
}

const escapeXml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch])

export function renderSitemap({ origin, urls }) {
  const base = normalizeOrigin(origin)
  const locations = [...new Set([`${base}/`, ...urls])].sort()
  check(locations.every(url => url.startsWith(`${base}/`)), `Sitemap URL outside ${base}`)
  check(locations.length <= 50000, 'Sitemap exceeds 50,000 URLs; split it into an index')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    locations.map(url => `  <url><loc>${escapeXml(url)}</loc></url>\n`).join('')}</urlset>\n`
}

// Release-level gate: public routes ready, then journeys or an explicit exception. Never device parity per route.
export function productionGate({ publicRoutesReady, publicBlocking = [], journeys, exception }) {
  check(publicRoutesReady === true, `Production requires every public route to be ready: ${
    publicBlocking.map(row => `${row.view} (${row.reasons.join(', ')})`).join('; ') || 'route summary missing'}`)
  check(Boolean(journeys?.accepted) !== Boolean(exception), 'Production needs accepted journeys or an exception, not both')
  return journeys?.accepted ? 'production-release' : 'user-authorized-production-exception'
}

export function buildReceipt({ target, budget, acceptance, boot, dataRevision, compiledRevision, origin, translationRelease,
  startup, seasonalCount, entityShellCount, journeys, approval, exception, generatedAt }) {
  const routes = acceptance.routes
  const production = target === 'production'
  const purpose = production
    ? productionGate({ publicRoutesReady: routes.publicRoutesReady, publicBlocking: routes.publicBlocking, journeys, exception })
    : 'device-review-preview'
  return {
    purpose, productionApproved: production, target, branch: BRANCH_BY_TARGET[target],
    sourceRevision: budget.sourceRevision, sourceDigest: budget.sourceDigest,
    release: boot.release, dataRevision, compiledRevision, translationRelease,
    initialJsGzipEstimate: startup.estimate, initialJsGzipLimit: startup.limit, startupPolicySha256: startup.policySha256,
    seasonalReadingRelease: 'seasonal-reading-v1', seasonalReadingCount: seasonalCount,
    entityHeadShells: entityShellCount, entityHeadShellOrigin: origin, siteOrigin: origin,
    searchIndexing: production ? 'allowed' : 'blocked',
    publicRoutesReady: routes.publicRoutesReady,
    allPublicRoutesMigrated: acceptance.allPublicRoutesMigrated, deviceReviewAccepted: acceptance.deviceReviewAccepted,
    journeys: journeys || null,
    ...(production ? { approval } : {}),
    ...(production && exception ? { exception: { date: approval.date, ownerStatement: approval.statement,
      scope: 'This frozen candidate only; the owner statement also waives the release-journeys receipt.' } } : {}),
    remainingRoutes: routes.unfinished, generatedAt,
  }
}

export function manifestDigest(manifest) {
  const sorted = [...manifest].sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0)
  return { manifest: sorted, manifestSha256: sha256(JSON.stringify(sorted)) }
}

export function deployCommand(target) {
  return `npx wrangler pages deploy dist --project-name ${PAGES_PROJECT} --branch ${BRANCH_BY_TARGET[target]}`
}
