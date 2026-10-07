import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

// Every scripts/verify-* file must either run in the Web Viewer Source Gate (directly, through
// npm scripts, through another covered check, or through the verifier batch) or be listed in
// config/verifier-coverage.json localOnly with a reason. New checks cannot silently stay out of CI.
const root = new URL('..', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const workflowFile = process.argv[2] || '../.github/workflows/web-viewer-source-gate.yml'
const workflow = read(workflowFile)
const scripts = JSON.parse(read('package.json')).scripts
const coverage = JSON.parse(read('config/verifier-coverage.json'))
const verifierPattern = /(verify-[\w.-]+?\.(?:mjs|js|py))\b/g
const all = readdirSync(new URL('scripts/', root)).filter(name => /^verify-.*\.(mjs|js|py)$/.test(name))
const exists = name => existsSync(new URL(`scripts/${name}`, root))

assert.match(workflow, /run: npm run verify:source-batch\b/, 'the source gate must run the verifier batch')
assert.equal(scripts['verify:source-batch'], 'node scripts/verify-verifier-coverage.mjs && node scripts/run-verifier-batch.mjs')

const covered = new Set(), expanded = new Set()
function scan(text) {
  for (const [, name] of text.matchAll(verifierPattern)) if (exists(name) && !covered.has(name)) {
    covered.add(name)
    scan(read(`scripts/${name}`))
  }
  for (const [, name] of text.matchAll(/npm run ([\w:.-]+)/g)) if (scripts[name] && !expanded.has(name)) {
    expanded.add(name)
    scan(scripts[name])
  }
}
scan(workflow)
const viaGate = new Set(covered)

const batch = coverage.batch
const localOnly = Object.entries(coverage.localOnly)
for (const [group, { reason, scripts: names }] of localOnly) {
  assert.ok(typeof reason === 'string' && reason.length > 20, `${group} needs a reason`)
  assert.ok(Array.isArray(names) && names.length, `${group} lists no scripts`)
}
const listed = [...batch, ...localOnly.flatMap(([, entry]) => entry.scripts)]
assert.equal(new Set(listed).size, listed.length, 'a script is listed twice in verifier-coverage.json')
for (const name of listed) {
  assert.ok(exists(name), `verifier-coverage.json lists a missing script: ${name}`)
  assert.ok(!viaGate.has(name), `${name} already runs in the source gate; remove it from verifier-coverage.json`)
}
for (const name of batch) scan(read(`scripts/${name}`))
const unaccounted = all.filter(name => !covered.has(name) && !listed.includes(name))
assert.deepEqual(unaccounted, [], 'verify scripts outside CI must be added to the batch or to localOnly with a reason')

const local = localOnly.reduce((sum, [, entry]) => sum + entry.scripts.length, 0)
console.log(`Verifier coverage: ${all.length} scripts; ${viaGate.size} through gate steps, ${batch.length} in the batch, ${local} local-only with reasons`)
