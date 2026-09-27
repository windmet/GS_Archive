import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { auditJson, forbiddenInitialModules, readBuildAudit } from './lib/archive-build-audit.mjs'
import { sha256, assert } from '../readmodels/lib/common.mjs'
import { summarizeRoutes, validateRouteEvidence } from '../readmodels/lib/cutover.mjs'
import { VALID_VIEWS } from '../src/core/archiveRoute.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
assert(args.every(arg => !arg.startsWith('--') || ['--progress', '--final'].includes(arg)), 'Unknown build-audit option')
assert(!(args.includes('--progress') && args.includes('--final')), 'Choose progress or final mode')
const dirs = args.filter(arg => !arg.startsWith('--'))
assert(dirs.length <= 1, 'Usage: verify-archive-build-audit.mjs [bundle] [--progress|--final]')
const bundle = path.resolve(dirs[0] || path.join(root, '.analysis/build-check'))
const { budget, acceptance } = await readBuildAudit(bundle)
const policyText = await fs.readFile(path.join(root, 'readmodels/contracts/startup-policy.json'), 'utf8')
const ledgerText = await fs.readFile(path.join(root, 'readmodels/contracts/routes.json'), 'utf8')
const policy = JSON.parse(policyText), ledger = JSON.parse(ledgerText)
assert(budget.policySha256 === sha256(policyText) && acceptance.routeLedgerSha256 === sha256(ledgerText), 'Audit contract changed after build')
assert(budget.sourceRevision === execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), 'Build audit is for another HEAD')
for (const [file, hash] of Object.entries(budget.sourceHashes)) {
  assert(!path.isAbsolute(file) && !file.split(/[\\/]/).includes('..'), 'Unsafe source proof path')
  assert(sha256(await fs.readFile(path.join(root, file))) === hash, `Source changed after build: ${file}`)
}
assert(sha256(auditJson(budget.sourceHashes)) === budget.sourceDigest, 'Source fingerprint mismatch')
const initialModules = [...new Set(budget.chunks.filter(chunk => budget.initialChunks.includes(chunk.fileName)).flatMap(chunk => chunk.modules))].sort()
assert(JSON.stringify(initialModules) === JSON.stringify(budget.initialModules), 'Initial module inventory mismatch')
assert(JSON.stringify(forbiddenInitialModules(initialModules, policy, ledger)) === JSON.stringify(budget.forbiddenModules), 'Forbidden-module audit disagrees with policy')
const routes = summarizeRoutes(ledger, VALID_VIEWS)
await validateRouteEvidence(ledger, root)
assert(JSON.stringify(routes) === JSON.stringify(acceptance.routes), 'Route summary changed after build')
assert(acceptance.allPublicRoutesMigrated === routes.allPublicRoutesMigrated &&
  acceptance.deviceReviewAccepted === (routes.deviceReviewAccepted && ledger.reviewedSourceDigest === budget.sourceDigest), 'Cutover conclusion disagrees with route ledger')
assert(budget.initialJsGzipEstimate <= policy.initialJsGzipLimit, 'Startup JS budget exceeded')
const report = { mode: args.includes('--progress') ? 'progress' : 'final', sourceRevision: budget.sourceRevision,
  sourceDirty: budget.sourceDirty, release: budget.release, initialChunks: budget.initialChunks,
  initialJsGzipEstimate: budget.initialJsGzipEstimate, forbiddenModules: budget.forbiddenModules,
  productionLegacyModules: budget.productionLegacyModules, legacyCallSites: budget.legacyCallSites,
  globalArchiveLoadRemoved: acceptance.globalArchiveLoadRemoved, allPublicRoutesMigrated: acceptance.allPublicRoutesMigrated,
  deviceReviewAccepted: acceptance.deviceReviewAccepted, routeCounts: routes.counts }
console.log(auditJson(report))
if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `\nArchive cutover audit (progress is not release approval)\n\n\`\`\`json\n${auditJson(report)}\`\`\`\n`)
if (!args.includes('--progress')) assert(!budget.sourceDirty && !budget.forbiddenModules.length &&
  acceptance.globalArchiveLoadRemoved && acceptance.allPublicRoutesMigrated && acceptance.deviceReviewAccepted,
  'Final cutover blocked: inspect the generated residual/route/device report')
