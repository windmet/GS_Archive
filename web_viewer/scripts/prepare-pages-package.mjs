import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { assert, createOutput, listFiles, safeRead, sha256 } from '../readmodels/lib/common.mjs'
import { verifyArtifacts } from '../readmodels/tools/verify_artifacts.mjs'
import { readBuildAudit } from './lib/archive-build-audit.mjs'
import { copyPreviewTranslations } from './lib/preview-translations.mjs'
import { withPortalScopePreload } from './lib/portal-preload.mjs'
import { STARTUP_POLICY, RECEIPT_BY_TARGET, buildReceipt, checkStartupBudget, deployCommand, evaluateJourneys,
  manifestDigest, parsePackageArgs, renderHeaders, renderRobots, renderSitemap } from './lib/pages-package.mjs'
import { SEASONAL_READING_PATH } from '../functions/data/[[path]].js'
import { DEFAULT_ORIGIN, loadEntitySources, renderEntityHeadShells } from './generate-entity-head-shells.mjs'

// The one Pages packager (docs/RELEASE_CONTRACT.md). Preview packages go to the device-review branch; a
// production package additionally needs the owner's words and either a journeys receipt for this source
// digest or an explicit exception. Neither target deploys, uploads to R2 or edits the Pages project.
const root = fileURLToPath(new URL('..', import.meta.url))
const options = parsePackageArgs(process.argv.slice(2))
const { target } = options
// The site the shells' canonical and og:url/og:image (and production's sitemap) point at.
const shellOrigin = options.origin || DEFAULT_ORIGIN
const bundle = path.join(root, '.analysis/build-check')
const models = await fs.realpath(options.models)
if (process.platform === 'win32') assert(path.parse(path.resolve(options.out)).root === path.parse(root).root, 'Keep Pages packages on the workspace drive')
execFileSync(process.execPath, [path.join(root, 'scripts/verify-archive-build-audit.mjs'), target === 'production' ? '--release' : '--progress'], { cwd: root, stdio: 'pipe' })
const { budget, acceptance } = await readBuildAudit(bundle)
assert(!budget.sourceDirty && !budget.forbiddenModules.length && acceptance.globalArchiveLoadRemoved,
  'Packaging requires committed source, clean initial imports and no global archive loader')
const startup = checkStartupBudget(budget, await fs.readFile(path.join(root, STARTUP_POLICY), 'utf8'))
let journeys = null
if (options.journeysFile) {
  const contract = JSON.parse(await fs.readFile(path.join(root, 'config/release-journeys.json'), 'utf8'))
  journeys = evaluateJourneys(contract, JSON.parse(await fs.readFile(options.journeysFile, 'utf8')), budget.sourceDigest)
}
await verifyArtifacts(models)
// The Portal's 315 岁时记 has no fallback since the 运营轨迹 timeline was retired: a release without it is not packaged.
execFileSync(process.execPath, [path.join(root, 'scripts/verify-portal-almanac.mjs'), models], { cwd: root, stdio: 'pipe' })
const bootstrap = await fs.readFile(path.join(models, 'bootstrap.inline.json'), 'utf8')
const boot = JSON.parse(bootstrap)
assert(boot.release === budget.release, 'Model release differs from code')
const html = await fs.readFile(path.join(bundle, 'index.html'), 'utf8')
const embedded = /<script type="application\/json" id="archive-bootstrap">([^<]*)<\/script>/.exec(html)
assert(embedded && JSON.stringify(JSON.parse(embedded[1])) === JSON.stringify(boot), 'Inline bootstrap differs from candidate')
const codeFiles = (await listFiles(bundle)).filter(file => !file.startsWith('audit/') && !file.startsWith('.vite/'))
assert(codeFiles.every(file => file === 'index.html' || file.startsWith('_app/')), 'Unexpected code package file')
const modelFiles = await listFiles(path.join(models, 'pages'))
assert(modelFiles.every(file => file.startsWith('_catalog/')), 'Model package contains non-catalog paths')
assert(codeFiles.length + modelFiles.length < 18000, 'Pages file budget exceeded')
let codeBytes = 0
for (const file of codeFiles) codeBytes += (await fs.stat(path.join(bundle, file))).size
assert(codeBytes <= 30 * 1024 * 1024, 'Code bundle too large; inspect publicDir and the import graph')
const translationRelease = JSON.parse(await fs.readFile(path.join(root, 'config/translation-release.json'), 'utf8'))
const translationManifest = JSON.parse(await fs.readFile(path.join(root, 'public/translations/manifest.json'), 'utf8'))
assert(translationManifest.release === translationRelease.release && translationManifest.entries.length === translationRelease.files,
  'Translation manifest disagrees with config/translation-release.json; run generate-translation-release')
const packageRoot = await createOutput(options.out, [bundle, models, path.join(root, 'public'), path.join(root, 'src')])
const dist = path.join(packageRoot, 'dist')
const copy = async (source, file, destination) => {
  const bytes = await safeRead(source, file)
  assert(bytes.length <= 25 * 1024 * 1024, `Oversized Pages file: ${file}`)
  const destinationFile = path.join(destination, file)
  await fs.mkdir(path.dirname(destinationFile), { recursive: true })
  await fs.writeFile(destinationFile, bytes, { flag: 'wx' })
}
for (const file of codeFiles) await copy(bundle, file, dist)
for (const file of modelFiles) await copy(path.join(models, 'pages'), file, dist)
await copyPreviewTranslations(root, dist)
// The all-idols Portal scope is preloaded beside the Portal index; its URL is in this candidate's index.
const portalIndex = JSON.parse(await fs.readFile(path.join(dist, ...boot.domains.portal.url.slice(1).split('/')), 'utf8'))
await fs.writeFile(path.join(dist, 'index.html'), withPortalScopePreload(await fs.readFile(path.join(dist, 'index.html'), 'utf8'), boot, portalIndex))
// Idol, unit, card, song and event head shells (docs/GS_ARCHIVE_PORTAL_STATIC_ROUTE_L2_20261013.md): rendered from this package's
// final index.html, which already carries the inline bootstrap, so they boot exactly like the root page.
const entitySources = loadEntitySources(root, { candidate: models })
assert(entitySources.release === boot.release, 'Entity head shells must come from the same read-model release')
const entityShells = renderEntityHeadShells({ template: await fs.readFile(path.join(dist, 'index.html'), 'utf8'), ...entitySources, origin: shellOrigin })
for (const shell of entityShells) {
  await fs.mkdir(path.dirname(path.join(dist, shell.path)), { recursive: true })
  await fs.writeFile(path.join(dist, shell.path), shell.html, { flag: 'wx' })
}
// Every folder that holds a head shell revalidates, so a new release is never hidden behind a cached shell.
const shellSections = [...new Set(entityShells.map(shell => shell.path.split('/')[0]))].sort()
// Work stories are no longer copied into the package: the R2 data/compiled snapshots carry them
// (functions/data/[[path]].js). A data revision without them would 404 the work Reader.
const readingManifest = JSON.parse(await fs.readFile(path.join(root, 'public/data/reading/manifest.json'), 'utf8'))
// The frozen R2 snapshot predates the seasonal Reading documents. Ship the
// exact documents advertised by this candidate, just as work is backfilled.
const seasonalEntries = readingManifest.entries.filter(entry => entry.domain === 'seasonal')
assert(seasonalEntries.length === 306, 'Seasonal preview requires 306 published Reading entries')
for (const entry of seasonalEntries) {
  const file = `data/reading/${entry.file}`
  assert(SEASONAL_READING_PATH.test(`/${file}`), `Seasonal Reading route missing: ${file}`)
  const bytes = await safeRead(path.join(root, 'public'), file)
  assert(`sha256:${sha256(bytes)}` === entry.sha256, `Seasonal Reading hash mismatch: ${file}`)
  await copy(path.join(root, 'public'), file, path.join(dist, '_seasonal-reading'))
}
for (const directory of ['functions', 'shared/deploy']) for (const file of await listFiles(path.join(root, directory))) {
  await copy(path.join(root, directory), file, path.join(packageRoot, directory))
}
// No wall clock: the same inputs must produce the same package bytes.
const generatedAt = execFileSync('git', ['show', '-s', '--format=%cI', budget.sourceRevision], { cwd: root, encoding: 'utf8' }).trim()
const receipt = buildReceipt({ target, budget, acceptance, boot, dataRevision: options.dataRevision,
  compiledRevision: options.compiledRevision, origin: shellOrigin,
  translationRelease: { release: translationRelease.release, files: translationRelease.files },
  startup, seasonalCount: seasonalEntries.length, entityShellCount: entityShells.length, journeys,
  approval: options.approval, exception: options.exception, generatedAt })
await fs.writeFile(path.join(dist, RECEIPT_BY_TARGET[target]), JSON.stringify(receipt, null, 2) + '\n')
await fs.writeFile(path.join(dist, 'robots.txt'), renderRobots({ target, origin: shellOrigin }))
if (target === 'production') await fs.writeFile(path.join(dist, 'sitemap.xml'), renderSitemap({ origin: shellOrigin, urls: entityShells.map(shell => shell.url) }))
await fs.writeFile(path.join(dist, '_routes.json'), JSON.stringify({version: 1, include: ['/assets/*', '/data/*'], exclude: ['/_app/*', '/_catalog/*', '/translations/*', '/_seasonal-reading/*']}))
await fs.writeFile(path.join(dist, '_headers'), renderHeaders({ target, shellSections }))
await fs.writeFile(path.join(packageRoot, 'wrangler.jsonc'), JSON.stringify({ name: 'gs-archive-preview',
  pages_build_output_dir: './dist', compatibility_date: '2026-09-13',
  vars: { ARCHIVE_GZIP_MODE: 'all', ARCHIVE_DATA_REVISION: options.dataRevision,
    ...(options.compiledRevision ? { ARCHIVE_COMPILED_REVISION: options.compiledRevision } : {}),
    ARCHIVE_SEASONAL_READING_RELEASE: 'seasonal-reading-v1' },
  r2_buckets: [{binding: 'ARCHIVE_ASSETS', bucket_name: 'sidem-archive-preview'}] }, null, 2))
const files = []
for (const file of await listFiles(dist)) {
  const bytes = await safeRead(dist, file)
  files.push({file, bytes: bytes.length, sha256: sha256(bytes)})
}
const { manifest, manifestSha256 } = manifestDigest(files)
const report = { ...receipt, files: manifest.length, bytes: manifest.reduce((sum, file) => sum + file.bytes, 0), manifestSha256, manifest }
assert(report.files < 18000, 'Pages file budget exceeded after backfills')
await fs.writeFile(path.join(packageRoot, 'package-report.json'), JSON.stringify(report, null, 2) + '\n')
await fs.writeFile(path.join(packageRoot, 'README.txt'), target === 'production'
  ? `PRODUCTION (${receipt.purpose}, approved ${options.approval.date}). Deploy: ${deployCommand(target)}. Then: node scripts/verify-deployed-site.mjs ${shellOrigin} --package <this directory>. Rollback: docs/RELEASE_CONTRACT.md.\n`
  : `DEVICE REVIEW ONLY. Deploy: ${deployCommand(target)}. Never deploy this package to master/production; build a --target production package instead.\n`)
console.log(JSON.stringify({packageRoot, target, purpose: receipt.purpose, files: report.files, bytes: report.bytes, manifestSha256,
  sourceRevision: receipt.sourceRevision, release: receipt.release, startupHeadroom: startup.headroom, deployed: false}, null, 2))
