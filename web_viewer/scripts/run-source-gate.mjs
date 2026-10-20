// Runs every step of the Web Viewer Source Gate locally, in workflow order, and reports all failures at the end
// instead of stopping at the first one. The steps come from the workflow file itself (lib/source-gate-workflow.mjs).
//   npm run gate:source                      every run step (npm ci is skipped; node_modules must exist)
//   npm run gate:source -- --only=camera     steps whose name contains the text
//   npm run gate:source -- --from="Verify Home"   start at the first step whose name contains the text
//   npm run gate:source -- --base=<sha>      diff base for the whitespace and publication-ledger steps
// The base defaults to the merge base with origin/master. A main checkout with the corpus and CRLF files can pass
// steps that fail in CI; reproduce those in an LF worktree (docs/CURRENT_STATE.md).
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { localExpressions, parseSourceGateSteps, substituteExpressions } from './lib/source-gate-workflow.mjs'

const webViewer = fileURLToPath(new URL('..', import.meta.url))
const repo = path.dirname(webViewer)
const option = name => process.argv.slice(2).find(arg => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()

const head = git('rev-parse', 'HEAD')
const base = option('base') || git('merge-base', 'HEAD', 'origin/master')
const expressions = localExpressions({ repo, base, head })
const skip = new Set(['Install dependencies'])
let steps = parseSourceGateSteps().filter(step => step.run && !skip.has(step.name))
const from = option('from'), only = option('only')
if (from) steps = steps.slice(Math.max(0, steps.findIndex(step => step.name.includes(from))))
if (only) steps = steps.filter(step => step.name.includes(only))

function run(step) {
  const cwd = step.workingDirectory ? path.resolve(webViewer, substituteExpressions(step.workingDirectory, expressions)) : webViewer
  const env = { ...process.env, CI: 'true' }
  for (const [key, value] of Object.entries(step.env)) env[key] = substituteExpressions(value, expressions)
  const command = substituteExpressions(step.run, expressions)
  return new Promise(resolve => {
    const started = Date.now()
    const output = []
    const child = spawn('bash', ['-eo', 'pipefail', '-c', command], { cwd, env })
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => output.push(chunk))
    child.on('close', code => resolve({ code, seconds: (Date.now() - started) / 1000, output: Buffer.concat(output).toString() }))
  })
}

const dirtyBefore = new Set(git('status', '--porcelain').split('\n').filter(Boolean))
const failures = []
for (const [index, step] of steps.entries()) {
  const result = await run(step)
  const label = `[${index + 1}/${steps.length}] ${step.name} (${result.seconds.toFixed(1)} s)`
  if (result.code === 0) { console.log(`PASS ${label}`); continue }
  failures.push(step.name)
  console.log(`FAIL ${label}`)
  console.log(result.output.split('\n').slice(-30).map(line => `  | ${line}`).join('\n'))
}
const touched = git('status', '--porcelain').split('\n').filter(line => line && !dirtyBefore.has(line))
if (touched.length) console.log(`\nFiles the steps rewrote (generators such as build:check; do not commit by accident):\n${touched.map(line => `  ${line}`).join('\n')}`)
console.log(`\nSource gate: ${steps.length - failures.length}/${steps.length} steps passed (base ${base.slice(0, 8)})`)
if (failures.length) {
  console.log(`Failed:\n${failures.map(name => `  - ${name}`).join('\n')}`)
  process.exitCode = 1
}
