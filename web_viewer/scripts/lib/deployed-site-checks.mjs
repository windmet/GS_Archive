// Post-deploy smoke for a Pages deployment (docs/RELEASE_CONTRACT.md, gate 3). Pure: every check goes through an
// injected get(path) -> { status, type, headers, body: Buffer, skipped? } and probeOrigin(origin), so the same code
// runs against curl, a local package directory (Pages semantics) and the fixtures in verify-deployed-site-checks.mjs.
import { getBrandMarkUrl, getOwnerAvatarUrl, getQqGroupQrUrl } from '../../src/utils/AssetResolver.js'
// The brand images come from the runtime resolver: the about page's avatar and QQ code went out on 11-04 without
// their R2 objects and no sample asked for them.
export const SAMPLE_KEYS = Object.freeze(['/data/compiled/manifest.json', '/data/reading/manifest.json',
  getBrandMarkUrl(), getOwnerAvatarUrl(), getQqGroupQrUrl(), '/assets/song-chart-track/live_lane_gradation.png'])
const RECEIPTS = ['production-receipt.json', 'preview-receipt.json']
const ENTITY_SHELL = /^(idols|cards|songs|units|events|gashas)\/[^/]+\/index\.html$/

const text = response => response.body ? response.body.toString('utf8') : ''
const isHtml = response => /text\/html/i.test(response.type || '')
function json(response) {
  if (response.status !== 200 || isHtml(response)) return null
  try { return JSON.parse(text(response)) } catch { return null }
}

// Same-site paths whose canonical must equal the receipt origin: a package lists its shells, a live site gets defaults.
export function shellSamples({ manifest, idols }) {
  if (manifest) {
    const bySection = new Map()
    for (const { file } of manifest) if (ENTITY_SHELL.test(file) && !bySection.has(file.split('/')[0])) bySection.set(file.split('/')[0], file)
    return ['/cards/', ...[...bySection.values()].map(file => `/${file.replace(/index\.html$/, '')}`)]
  }
  return ['/cards/', ...(idols?.[0]?.id ? [`/idols/${idols[0].id}/`] : [])]
}

export async function runSiteChecks({ get, probeOrigin, packageInfo = null, nonce = 'probe' }) {
  const rows = []
  const add = (id, status, detail) => rows.push({ id, status, detail })
  let receipt = null, receiptFile = null
  for (const file of RECEIPTS) {
    const value = json(await get(`/${file}`))
    if (value) { receipt = value; receiptFile = file; break }
  }
  const target = receipt?.target || (receipt?.productionApproved ? 'production' : 'preview')
  const siteOrigin = receipt?.siteOrigin || receipt?.entityHeadShellOrigin || null
  if (!receipt) add('receipt', 'fail', 'neither receipt is served as JSON')
  else if (receiptFile !== `${target}-receipt.json`) add('receipt', 'fail', `${receiptFile} served for a ${target} receipt`)
  else if (packageInfo && JSON.stringify(receipt) !== JSON.stringify(packageInfo.receipt)) add('receipt', 'fail', 'deployed receipt differs from the package receipt')
  else add('receipt', 'pass', `${receiptFile}: ${target}, source ${String(receipt.sourceRevision).slice(0, 8)}, release ${String(receipt.release).slice(0, 8)}${packageInfo ? ', equals package' : ''}`)

  const index = await get('/')
  const html = text(index)
  if (index.status !== 200 || !isHtml(index)) add('index', 'fail', `/ answered ${index.status} ${index.type}`)
  const robotsHeader = index.headers?.['x-robots-tag'] || ''
  const noindex = /noindex/i.test(robotsHeader)
  add('indexing-header', (target === 'preview') === noindex ? 'pass' : 'fail',
    `${target}: X-Robots-Tag ${robotsHeader ? `"${robotsHeader}"` : 'absent'}${target === 'preview' ? ' (preview must be noindex)' : ' (production must be indexable)'}`)
  const inline = /<script type="application\/json" id="archive-bootstrap">([^<]*)<\/script>/.exec(html)
  let boot = null
  try { boot = inline && JSON.parse(inline[1]) } catch { boot = null }
  add('inline-bootstrap', boot && (!receipt || boot.release === receipt.release) ? 'pass' : 'fail',
    boot ? `release ${String(boot.release).slice(0, 8)}${receipt && boot.release !== receipt.release ? ` but receipt says ${String(receipt.release).slice(0, 8)}` : ''}` : 'missing or invalid inline bootstrap')

  const scripts = [...new Set([...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g), ...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)].map(m => m[1]))]
  if (!scripts.length) add('entry-chunks', 'fail', 'index.html references no module script')
  else {
    const bad = []
    for (const src of scripts) {
      const response = await get(src)
      if (response.status !== 200 || !/javascript/i.test(response.type || '') || text(response).trimStart().startsWith('<')) bad.push(`${src} ${response.status} ${response.type}`)
    }
    add('entry-chunks', bad.length ? 'fail' : 'pass', bad.length ? bad.join('; ') : `${scripts.length} module script(s) served as JavaScript`)
  }
  const missing = await get(`/_app/__gs-missing-${nonce}.js`)
  add('missing-chunk', missing.status === 404 ? 'pass' : 'warn', missing.status === 404 ? 'a missing chunk is a 404'
    : `a missing chunk answers ${missing.status} ${missing.type}${isHtml(missing) ? ': the SPA fallback hands stale tabs HTML for old chunks' : ''}`)

  const catalog = json(await get('/_catalog/bootstrap.json'))
  add('catalog-bootstrap', catalog && (!receipt || catalog.release === receipt.release) ? 'pass' : 'fail',
    catalog ? `release ${String(catalog.release).slice(0, 8)}` : '/_catalog/bootstrap.json is not JSON 200')
  const domains = Object.entries(boot?.domains || {}).filter(([, domain]) => typeof domain?.url === 'string')
  if (domains.length) {
    const bad = []
    for (const [name, domain] of domains) {
      const response = await get(domain.url)
      if (!json(response)) bad.push(`${name} ${response.status}${response.error ? ` ${response.error}` : ''}`)
    }
    add('catalog-domains', bad.length ? 'fail' : 'pass', bad.length ? `not JSON 200: ${bad.join(', ')}` : `${domains.length} domain indexes`)
  }
  const samples = { pass: 0, skipped: 0, bad: [] }
  for (const key of SAMPLE_KEYS) {
    const response = await get(key)
    if (response.skipped) samples.skipped++
    else if (response.status === 200 && !isHtml(response)) samples.pass++
    else samples.bad.push(`${key} ${response.status}`)
  }
  add('r2-samples', samples.bad.length ? 'fail' : samples.pass ? 'pass' : 'skip',
    samples.bad.length ? samples.bad.join('; ') : samples.pass ? `${samples.pass} /data and /assets keys` : 'R2 keys are not served by a local package')

  const shells = shellSamples({ manifest: packageInfo?.manifest, idols: boot?.idols })
  const wrong = []
  for (const shell of shells) {
    const href = /<link rel="canonical" href="([^"]+)"/.exec(text(await get(shell)))?.[1]
    if (!siteOrigin || href !== `${siteOrigin}${shell}`) wrong.push(`${shell} -> ${href || 'no canonical'}`)
  }
  add('canonical', wrong.length ? 'fail' : 'pass', wrong.length ? `expected ${siteOrigin}: ${wrong.join('; ')}` : `${shells.length} shells point at ${siteOrigin}`)
  if (siteOrigin && probeOrigin) {
    const probe = await probeOrigin(siteOrigin)
    add('site-origin', probe.skipped ? 'skip' : probe.reachable ? 'pass' : 'fail', probe.detail)
  }

  const robots = await get('/robots.txt')
  const robotsText = text(robots)
  const robotsOk = robots.status === 200 && /text\/plain/i.test(robots.type || '') && (target === 'preview'
    ? /^Disallow: \/$/m.test(robotsText)
    : /^Allow: \/$/m.test(robotsText) && !/^Disallow: \/$/m.test(robotsText) && robotsText.includes(`Sitemap: ${siteOrigin}/sitemap.xml`))
  add('robots', robotsOk ? 'pass' : 'fail', robotsOk ? `${target} robots.txt` : `/robots.txt answered ${robots.status} ${robots.type}${isHtml(robots) ? ' (SPA fallback HTML)' : ''}`)
  if (target === 'production') {
    const sitemap = await get('/sitemap.xml')
    const locations = [...text(sitemap).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
    const ok = sitemap.status === 200 && !isHtml(sitemap) && locations.length > 0 && locations.every(url => url.startsWith(`${siteOrigin}/`))
    add('sitemap', ok ? 'pass' : 'fail', ok ? `${locations.length} URLs under ${siteOrigin}` : `/sitemap.xml answered ${sitemap.status} ${sitemap.type}, ${locations.length} locations`)
  }
  return { target, siteOrigin, receipt, rows }
}

// Cloudflare Pages without a top-level 404.html: an existing file, else index.html (SPA fallback); /data and
// /assets belong to the Functions + R2 and are not part of a package directory.
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp' }
export function parseHeadersFile(source) {
  const rules = []
  for (const line of source.split('\n')) {
    if (!line.trim()) continue
    if (!/^\s/.test(line)) rules.push({ pattern: line.trim(), headers: {} })
    else if (rules.length) {
      const at = line.indexOf(':')
      rules.at(-1).headers[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim()
    }
  }
  return rules
}
export function createPackageFetcher(readFile) {
  const headerRules = parseHeadersFile(readFile('_headers')?.toString('utf8') || '')
  return async request => {
    const pathname = decodeURIComponent(request.split('?')[0])
    if (/^\/(data|assets)\//.test(pathname)) return { status: 0, type: '', headers: {}, body: Buffer.alloc(0), skipped: true }
    const relative = pathname.slice(1)
    const candidates = relative === '' ? ['index.html'] : relative.endsWith('/') ? [`${relative}index.html`] : [relative, `${relative}/index.html`]
    let file = candidates.find(name => readFile(name)), status = 200
    if (!file) file = 'index.html'
    const extension = file.slice(file.lastIndexOf('.'))
    const headers = {}
    for (const rule of headerRules) {
      const matches = rule.pattern.endsWith('*') ? pathname.startsWith(rule.pattern.slice(0, -1)) : rule.pattern === pathname
      if (matches) Object.assign(headers, rule.headers)
    }
    return { status, type: TYPES[extension] || 'application/octet-stream', headers, body: readFile(file) }
  }
}
