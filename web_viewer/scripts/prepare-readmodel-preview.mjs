import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { assert, parseArgs, createOutput, listFiles, safeRead, sha256 } from '../readmodels/lib/common.mjs'
import { verifyArtifacts } from '../readmodels/tools/verify_artifacts.mjs'
import { readBuildAudit } from './lib/archive-build-audit.mjs'
import { copyPreviewTranslations } from './lib/preview-translations.mjs'

// Deliberately separate from final assemble_pages: this package is for device
// review on a fixed non-production branch. It never grants final acceptance.
const root = fileURLToPath(new URL('..', import.meta.url))
const a = parseArgs(process.argv.slice(2), ['--models', '--out', '--data-revision'])
assert(a['--models'] && a['--out'] && /^[a-f0-9]{64}$/.test(a['--data-revision'] || ''),
  'Usage: --models <verified candidate> --out <new package directory> --data-revision <existing R2 snapshot>')
const bundle = path.join(root, '.analysis/build-check')
const models = await fs.realpath(a['--models'])
if (process.platform === 'win32') assert(path.parse(path.resolve(a['--out'])).root === path.parse(root).root, 'Keep preview packages on the workspace drive')
execFileSync(process.execPath, [path.join(root, 'scripts/verify-archive-build-audit.mjs'), '--progress'], { cwd: root, stdio: 'pipe' })
const { budget, acceptance } = await readBuildAudit(bundle)
assert(!budget.sourceDirty && !budget.forbiddenModules.length && acceptance.globalArchiveLoadRemoved,
  'Preview requires committed source, clean initial imports and no global archive loader')
await verifyArtifacts(models)
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
const packageRoot = await createOutput(a['--out'], [bundle, models, path.join(root, 'public'), path.join(root, 'src')])
const dist = path.join(packageRoot, 'dist')
const manifest = []
const copy = async (source, file, destination) => {
  const bytes = await safeRead(source, file)
  assert(bytes.length <= 25 * 1024 * 1024, `Oversized Pages file: ${file}`)
  const target = path.join(destination, file)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, bytes, { flag: 'wx' })
}
for (const file of codeFiles) await copy(bundle, file, dist)
for (const file of modelFiles) await copy(path.join(models, 'pages'), file, dist)
await copyPreviewTranslations(root, dist)
for (const directory of ['functions', 'shared/deploy']) for (const file of await listFiles(path.join(root, directory))) {
  await copy(path.join(root, directory), file, path.join(packageRoot, directory))
}
const receipt = { purpose: 'device-review-preview', productionApproved: false,
  branch: 'gs-architecture-device-test', sourceRevision: budget.sourceRevision, sourceDigest: budget.sourceDigest,
  release: boot.release, dataRevision: a['--data-revision'], initialJsGzipEstimate: budget.initialJsGzipEstimate,
  allPublicRoutesMigrated: acceptance.allPublicRoutesMigrated, deviceReviewAccepted: acceptance.deviceReviewAccepted,
  remainingRoutes: acceptance.routes.unfinished, generatedAt: new Date().toISOString() }
await fs.writeFile(path.join(dist, 'preview-receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
await fs.writeFile(path.join(dist, '_routes.json'), JSON.stringify({version: 1, include: ['/assets/*', '/data/*'], exclude: ['/_app/*', '/_catalog/*', '/translations/*']}))
await fs.writeFile(path.join(dist, '_headers'), `/*
  X-Robots-Tag: noindex, nofollow
/_app/*
  Cache-Control: public, max-age=31536000, immutable
/_catalog/v/*
  Cache-Control: public, max-age=31536000, immutable
/_catalog/bootstrap.json
  Cache-Control: no-cache
/preview-receipt.json
  Cache-Control: no-store
/index.html
  Cache-Control: no-cache
`)
await fs.writeFile(path.join(packageRoot, 'wrangler.jsonc'), JSON.stringify({ name: 'gs-archive-preview',
  pages_build_output_dir: './dist', compatibility_date: '2026-09-13',
  vars: { ARCHIVE_GZIP_MODE: 'all', ARCHIVE_DATA_REVISION: a['--data-revision'] },
  r2_buckets: [{binding: 'ARCHIVE_ASSETS', bucket_name: 'sidem-archive-preview'}] }, null, 2))
for (const file of await listFiles(dist)) {
  const bytes = await safeRead(dist, file)
  manifest.push({file, bytes: bytes.length, sha256: sha256(bytes)})
}
const report = { ...receipt, packageRoot, files: manifest.length, bytes: manifest.reduce((sum, file) => sum + file.bytes, 0), manifest }
await fs.writeFile(path.join(packageRoot, 'preview-package.json'), JSON.stringify(report, null, 2))
await fs.writeFile(path.join(packageRoot, 'README.txt'), 'DEVICE REVIEW ONLY. Deploy dist with --project-name gs-archive-preview --branch gs-architecture-device-test. Never deploy this package to master/production. Final assemble_pages gate remains separate.\n')
console.log(JSON.stringify({packageRoot, files: report.files, bytes: report.bytes, sourceRevision: receipt.sourceRevision,
  release: receipt.release, productionApproved: false, deployed: false}, null, 2))
