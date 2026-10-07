import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Runs config/verifier-coverage.json "batch": source-only checks that need no corpus, server or
// extra packages. Every check runs; failures are summarised at the end. Node checks get
// --experimental-vm-modules because several execute real SFCs through vm.SourceTextModule.
const root = new URL('..', import.meta.url)
const { batch } = JSON.parse(readFileSync(new URL('config/verifier-coverage.json', root), 'utf8'))
const failed = []
for (const script of batch) {
  const command = script.endsWith('.py')
    ? ['python', [`scripts/${script}`]]
    : [process.execPath, ['--experimental-vm-modules', '--no-warnings=ExperimentalWarning', `scripts/${script}`]]
  const started = Date.now()
  const run = spawnSync(command[0], command[1], { cwd: root, encoding: 'utf8', timeout: 180_000 })
  const ok = run.status === 0
  console.log(`${ok ? 'PASS' : 'FAIL'} ${script} (${Date.now() - started} ms)`)
  if (!ok) {
    failed.push(script)
    console.log(`${run.stdout || ''}${run.stderr || ''}${run.error ? String(run.error) : ''}`.trim().split('\n').slice(-30).join('\n'))
  }
}
console.log(`Verifier batch: ${batch.length - failed.length}/${batch.length} passed`)
if (failed.length) {
  console.error(`Failed: ${failed.join(', ')}`)
  process.exit(1)
}
