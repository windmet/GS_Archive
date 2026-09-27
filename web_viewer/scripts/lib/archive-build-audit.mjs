import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { sha256, assert } from '../../readmodels/lib/common.mjs'
import { summarizeRoutes, validateRouteEvidence } from '../../readmodels/lib/cutover.mjs'
import { VALID_VIEWS } from '../../src/core/archiveRoute.js'

export const auditJson = value => JSON.stringify(value, null, 2) + '\n'
const sorted = values => [...new Set(values)].sort()
const cleanModule = (root, id) => id.startsWith('\0') ? `virtual:${id.slice(1)}`
  : path.relative(root, id.split('?')[0]).replaceAll('\\', '/')

export function initialChunkClosure(chunks) {
  const byName = new Map(chunks.map(chunk => [chunk.fileName, chunk]))
  const roots = chunks.filter(chunk => chunk.isEntry).map(chunk => chunk.fileName)
  assert(roots.length, 'Build audit requires an entry chunk')
  const seen = new Set()
  const visit = name => {
    if (seen.has(name)) return
    assert(byName.has(name), `Unresolved static chunk: ${name}`)
    seen.add(name)
    for (const target of byName.get(name).imports) visit(target)
  }
  roots.forEach(visit)
  return [...seen].sort()
}

export function forbiddenInitialModules(modules, policy, ledger) {
  const routeModules = new Set(ledger.routes.filter(route => route.component.status !== 'shell').map(route => route.component.module))
  return sorted(modules.filter(id => routeModules.has(id) || policy.forbiddenInitialModules.includes(id) ||
    policy.forbiddenInitialPrefixes.some(prefix => id.startsWith(prefix))))
}

function calledLegacyFunctions(ast, names) {
  const found = []
  const visit = node => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'CallExpression') {
      const callee = node.callee?.type === 'Identifier' ? node.callee.name
        : node.callee?.type === 'MemberExpression' && !node.callee.computed ? node.callee.property?.name : ''
      if (names.includes(callee)) found.push(callee)
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit)
      else if (value && typeof value === 'object') visit(value)
    }
  }
  visit(ast)
  return sorted(found)
}

// Rollup supplies the actual emitted graph. Dynamic imports are recorded but
// are not followed when computing the first static entry closure.
export function archiveBuildAuditPlugin(root) {
  return {
    name: 'archive-build-audit', enforce: 'post',
    async generateBundle(_options, bundle) {
      const read = file => fs.readFile(path.join(root, file), 'utf8')
      const ledgerText = await read('readmodels/contracts/routes.json')
      const ledger = JSON.parse(ledgerText)
      const policyText = await read('readmodels/contracts/startup-policy.json')
      const policy = JSON.parse(policyText)
      const boot = JSON.parse(await read('readmodels/bootstrap.inline.json'))
      const routes = summarizeRoutes(ledger, VALID_VIEWS)
      await validateRouteEvidence(ledger, root)
      assert(ledger.release === boot.release, 'Route ledger release differs from bootstrap')
      const chunks = Object.values(bundle).filter(item => item.type === 'chunk')
      const initialChunks = initialChunkClosure(chunks)
      const chunkProof = chunks.map(chunk => ({ fileName: chunk.fileName, isEntry: chunk.isEntry,
        imports: chunk.imports, dynamicImports: chunk.dynamicImports, bytes: Buffer.byteLength(chunk.code),
        gzipBytes: gzipSync(chunk.code).length, sha256: sha256(chunk.code),
        modules: sorted(Object.keys(chunk.modules).filter(id => chunk.modules[id].renderedLength > 0).map(id => cleanModule(root, id))),
      })).sort((a, b) => a.fileName.localeCompare(b.fileName))
      const initial = chunkProof.filter(chunk => initialChunks.includes(chunk.fileName))
      const initialModules = sorted(initial.flatMap(chunk => chunk.modules))
      const productionModules = sorted(chunkProof.flatMap(chunk => chunk.modules))
      const sources = new Map(), legacyCallSites = []
      for (const chunk of chunks) for (const [id, rendered] of Object.entries(chunk.modules)) {
        const name = cleanModule(root, id)
        if (rendered.renderedLength <= 0 || !/^(src|shared|readmodels\/runtime)\//.test(name)) continue
        if (!sources.has(name)) sources.set(name, sha256(await fs.readFile(path.join(root, name))))
        const code = this.getModuleInfo(id)?.code
        if (code) for (const callee of calledLegacyFunctions(this.parse(code), policy.globalArchiveCalls)) {
          if (!legacyCallSites.some(item => item.module === name && item.callee === callee)) legacyCallSites.push({ module: name, callee })
        }
      }
      for (const name of ['package.json', 'package-lock.json', 'vite.config.js', 'readmodels/bootstrap.inline.json',
        'scripts/build-check.mjs', 'scripts/lib/archive-build-audit.mjs', 'scripts/verify-archive-build-audit.mjs',
        'readmodels/lib/cutover.mjs']) sources.set(name, sha256(await read(name)))
      const sourceHashes = Object.fromEntries([...sources].sort(([a], [b]) => a.localeCompare(b)))
      const sourceDigest = sha256(auditJson(sourceHashes))
      const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
      const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--',
        'src', 'shared', 'readmodels', 'scripts/lib/archive-build-audit.mjs', 'scripts/verify-archive-build-audit.mjs', 'scripts/build-check.mjs', 'package.json', 'package-lock.json', 'vite.config.js'],
      { cwd: root, encoding: 'utf8' }).trim()
      const budget = { schema_version: 1, auditVersion: 1, sourceRevision, sourceDirty: Boolean(status), sourceDigest,
        release: boot.release, policySha256: sha256(policyText), initialChunks, initialModules, chunks: chunkProof, sourceHashes,
        forbiddenModules: forbiddenInitialModules(initialModules, policy, ledger),
        initialJsGzipEstimate: initial.reduce((sum, chunk) => sum + chunk.gzipBytes, 0),
        initialJsGzipLimit: policy.initialJsGzipLimit,
        productionLegacyModules: productionModules.filter(id => policy.globalArchiveModules.includes(id)),
        legacyCallSites: legacyCallSites.sort((a, b) => `${a.module}:${a.callee}`.localeCompare(`${b.module}:${b.callee}`)),
        scope: 'Emitted static entry closure and retained production modules; gzip estimate is not measured device/network performance.',
      }
      const mismatches = ledger.routes.filter(route => route.component.status === 'dynamic' && initialModules.includes(route.component.module)).map(route => route.view)
      assert(!mismatches.length, `Route ledger dynamic component is in startup: ${mismatches.join(', ')}`)
      const budgetText = auditJson(budget)
      const acceptance = { schema_version: 1, auditVersion: 1, sourceRevision, sourceDirty: budget.sourceDirty, sourceDigest,
        release: boot.release, startupBudgetSha256: sha256(budgetText), routeLedgerSha256: sha256(ledgerText),
        ledgerReviewedRevision: ledger.reviewedSourceRevision,
        globalArchiveLoadRemoved: !budget.productionLegacyModules.length && !budget.legacyCallSites.length,
        allPublicRoutesMigrated: routes.allPublicRoutesMigrated,
        deviceReviewAccepted: routes.deviceReviewAccepted && ledger.reviewedSourceDigest === sourceDigest,
        routes, scope: 'Generated from this build plus reviewed route ledger. Local Browser evidence never grants device acceptance.',
      }
      this.emitFile({ type: 'asset', fileName: 'audit/startup-budget.json', source: budgetText })
      this.emitFile({ type: 'asset', fileName: 'audit/readmodel-cutover.json', source: auditJson(acceptance) })
    },
    async writeBundle(options) {
      // Vite can rewrite preload references after generateBundle. Bind proof to
      // the final bytes on disk, while retaining Rollup's module/import graph.
      const out = options.dir
      const budgetPath = path.join(out, 'audit/startup-budget.json')
      const acceptancePath = path.join(out, 'audit/readmodel-cutover.json')
      const budget = JSON.parse(await fs.readFile(budgetPath, 'utf8'))
      const acceptance = JSON.parse(await fs.readFile(acceptancePath, 'utf8'))
      for (const chunk of budget.chunks) {
        const code = await fs.readFile(path.join(out, chunk.fileName))
        chunk.bytes = code.length
        chunk.gzipBytes = gzipSync(code).length
        chunk.sha256 = sha256(code)
      }
      budget.initialJsGzipEstimate = budget.chunks.filter(chunk => budget.initialChunks.includes(chunk.fileName))
        .reduce((sum, chunk) => sum + chunk.gzipBytes, 0)
      const budgetText = auditJson(budget)
      acceptance.startupBudgetSha256 = sha256(budgetText)
      await fs.writeFile(budgetPath, budgetText)
      await fs.writeFile(acceptancePath, auditJson(acceptance))
    },
  }
}

export async function readBuildAudit(bundleRoot) {
  const budgetText = await fs.readFile(path.join(bundleRoot, 'audit/startup-budget.json'), 'utf8')
  const budget = JSON.parse(budgetText)
  const acceptance = JSON.parse(await fs.readFile(path.join(bundleRoot, 'audit/readmodel-cutover.json'), 'utf8'))
  assert(budget.auditVersion === 1 && acceptance.auditVersion === 1, 'Missing generated build audit')
  assert(acceptance.startupBudgetSha256 === sha256(budgetText), 'Cutover proof is bound to another startup audit')
  assert(acceptance.sourceRevision === budget.sourceRevision && acceptance.sourceDigest === budget.sourceDigest &&
    acceptance.release === budget.release && acceptance.sourceDirty === budget.sourceDirty, 'Build audit identity mismatch')
  assert(Array.isArray(budget.chunks) && Array.isArray(budget.initialChunks), 'Missing chunk graph')
  assert(JSON.stringify(initialChunkClosure(budget.chunks)) === JSON.stringify(budget.initialChunks), 'Entry closure mismatch')
  let gzipBytes = 0
  for (const chunk of budget.chunks) {
    assert(!path.isAbsolute(chunk.fileName) && !chunk.fileName.split(/[\\/]/).includes('..'), 'Unsafe chunk path')
    const code = await fs.readFile(path.join(bundleRoot, chunk.fileName))
    assert(sha256(code) === chunk.sha256 && code.length === chunk.bytes && gzipSync(code).length === chunk.gzipBytes, `Built chunk drift: ${chunk.fileName}`)
    if (budget.initialChunks.includes(chunk.fileName)) gzipBytes += chunk.gzipBytes
  }
  assert(gzipBytes === budget.initialJsGzipEstimate && gzipBytes > 0, 'Startup gzip total mismatch')
  assert(acceptance.globalArchiveLoadRemoved === (!budget.productionLegacyModules.length && !budget.legacyCallSites.length), 'Global loader conclusion disagrees with production graph')
  assert(acceptance.routes?.counts?.routes === VALID_VIEWS.size && Array.isArray(acceptance.routes.unfinished), 'Missing public-route summary')
  const migrated = acceptance.routes.unfinished.every(row => row.reasons.every(reason => reason === 'device'))
  assert(acceptance.allPublicRoutesMigrated === migrated, 'Cutover gate missing: route conclusion disagrees with residuals')
  assert(!acceptance.deviceReviewAccepted || acceptance.routes.counts.deviceAccepted === VALID_VIEWS.size,
    'Device conclusion disagrees with accepted route count')
  return { budget, acceptance }
}
