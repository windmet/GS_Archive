import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPackageFetcher, runSiteChecks } from './lib/deployed-site-checks.mjs'

// Post-deploy smoke (docs/RELEASE_CONTRACT.md, gate 3):
//   node scripts/verify-deployed-site.mjs https://preview.gs-archive.com [--package <packageRoot>] [--with-translations] [--json]
//   node scripts/verify-deployed-site.mjs --package <packageRoot> --local      (offline: the package dist with Pages semantics)
// Network goes through curl (node https ignores the proxy); every URL carries ?t= so the edge cache cannot answer.
const root = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const option = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : undefined }
const local = args.includes('--local'), packageRoot = option('--package')
const origin = args.find(arg => /^https:\/\//.test(arg))?.replace(/\/$/, '')
if (local ? !packageRoot : !origin) throw new Error('Usage: verify-deployed-site.mjs https://<origin> [--package <dir>] [--with-translations] [--json] | --package <dir> --local')
let packageInfo = null
if (packageRoot) {
  const dist = path.join(packageRoot, 'dist')
  const receiptFile = ['production-receipt.json', 'preview-receipt.json'].find(file => existsSync(path.join(dist, file)))
  if (!receiptFile) throw new Error(`No receipt in ${dist}`)
  packageInfo = { receipt: JSON.parse(readFileSync(path.join(dist, receiptFile), 'utf8')),
    manifest: JSON.parse(readFileSync(path.join(packageRoot, 'package-report.json'), 'utf8')).manifest }
}

const nonce = Date.now().toString(36)
function curl(url, { header = [], attempt = 1 } = {}) {
  // -L: a same-origin redirect (the Functions answer some keys with 302) is followed like a browser would.
  const run = spawnSync('curl', ['-sS', '-L', '-m', '30', '--compressed', ...header.flatMap(value => ['-H', value]), '-o', '-', '-w', '%{stderr}\n@@GS@@%{json}\n@@GS@@%{header_json}', url],
    { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 })
  const [, info = '{}', headerJson = '{}'] = run.stderr.toString('utf8').split('\n@@GS@@')
  const meta = JSON.parse(info), headers = {}
  for (const [name, values] of Object.entries(JSON.parse(headerJson || '{}'))) headers[name.toLowerCase()] = [].concat(values).join(', ')
  // One retry for a transport failure (status 0): a single dropped connection is not a deployment defect.
  if (!Number(meta.http_code) && attempt === 1) return curl(url, { header, attempt: 2 })
  return { status: Number(meta.http_code) || 0, type: meta.content_type || '', headers, body: run.stdout,
    error: meta.exitcode ? `curl ${meta.exitcode}: ${meta.errormsg}` : null }
}
const get = local
  ? createPackageFetcher(relative => { const file = path.join(packageRoot, 'dist', relative); try { return statSync(file).isFile() ? readFileSync(file) : null } catch { return null } })
  : async request => curl(`${origin}${request}${request.includes('?') ? '&' : '?'}t=${nonce}`)
async function probeOrigin(siteOrigin) {
  if (local) return { skipped: true, detail: `${siteOrigin} not probed in --local mode` }
  const response = curl(`${siteOrigin}/?t=${nonce}`)
  if (response.status >= 200 && response.status < 400) return { reachable: true, detail: `${siteOrigin} answers ${response.status}` }
  const host = new URL(siteOrigin).hostname
  const dns = curl(`https://cloudflare-dns.com/dns-query?name=${host}&type=A`, { header: ['accept: application/dns-json'] })
  let answer = 'DNS lookup failed'
  try {
    const records = (JSON.parse(dns.body.toString('utf8')).Answer || []).map(record => record.data)
    answer = records.length ? `DNS ${records.join(', ')}` : 'DNS has no A/CNAME record'
  } catch { /* keep the failure text */ }
  return { reachable: false, detail: `${siteOrigin} unreachable (${response.error || response.status}); ${answer}` }
}

// An origin that does not answer at all gets one row with the DNS answer instead of a dozen transport failures.
const reach = local ? { reachable: true } : await probeOrigin(origin)
if (!reach.reachable) {
  console.log(`FAIL origin             ${reach.detail}`)
  console.error('Deployed-site smoke failed: origin')
  process.exit(1)
}
const result = await runSiteChecks({ get, probeOrigin, packageInfo, nonce })
if (args.includes('--with-translations') && !local) {
  const run = spawnSync(process.execPath, [path.join(root, 'scripts/verify-deployed-translations.mjs'), origin], { encoding: 'utf8' })
  result.rows.push({ id: 'translations', status: run.status === 0 ? 'pass' : 'fail', detail: (run.stdout || run.stderr).trim().split('\n').at(-1) })
} else result.rows.push({ id: 'translations', status: 'skip', detail: local ? 'not in --local mode' : 'run with --with-translations (or verify-deployed-translations.mjs)' })
if (args.includes('--json')) console.log(JSON.stringify({ origin: origin || null, package: packageRoot || null, ...result }, null, 2))
else {
  console.log(`${local ? `local package ${packageRoot}` : origin}: ${result.target} receipt, site origin ${result.siteOrigin}`)
  for (const row of result.rows) console.log(`${row.status.toUpperCase().padEnd(4)} ${row.id.padEnd(18)} ${row.detail}`)
}
const failed = result.rows.filter(row => row.status === 'fail')
if (failed.length) { console.error(`Deployed-site smoke failed: ${failed.map(row => row.id).join(', ')}`); process.exit(1) }
