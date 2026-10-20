// The Source Gate reports every failure in one run, and `npm run gate:source` runs the same steps locally: every
// check after the install carries the keep-going condition, and every expression the steps use has a local value.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { KEEP_GOING, SOURCE_GATE_WORKFLOW, localExpressions, parseSourceGateSteps, substituteExpressions } from './lib/source-gate-workflow.mjs'

// Parser shapes: inline, `|` block and `>-` folded runs, env, working-directory, if, uses.
{
  const steps = parseSourceGateSteps(`jobs:
  job:
    steps:
      - name: Checkout
        uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - name: Inline
        if: \${{ x }}
        run: npm run a && npm run b
      - name: Block
        working-directory: \${{ github.workspace }}
        env:
          BASE_SHA: \${{ base }}
        run: |
          if [ -n "$BASE_SHA" ]; then
            git diff --check
          fi

      - name: Folded
        run: >-
          npm run c --
          --base "\${{ base }}"
`)
  assert.deepEqual(steps.map(step => step.name), ['Checkout', 'Inline', 'Block', 'Folded'])
  assert.equal(steps[0].uses, 'actions/checkout@v7'); assert.equal(steps[0].run, undefined)
  assert.equal(steps[1].run, 'npm run a && npm run b'); assert.equal(steps[1].if, '${{ x }}')
  assert.equal(steps[2].run, 'if [ -n "$BASE_SHA" ]; then\n  git diff --check\nfi')
  assert.equal(steps[2].workingDirectory, '${{ github.workspace }}'); assert.deepEqual(steps[2].env, { BASE_SHA: '${{ base }}' })
  assert.equal(steps[3].run, 'npm run c -- --base "${{ base }}"')
  assert.throws(() => substituteExpressions('${{ secrets.TOKEN }}', {}), /No local value/)
}

// The real workflow.
const source = readFileSync(SOURCE_GATE_WORKFLOW, 'utf8')
const steps = parseSourceGateSteps(source)
const install = steps.findIndex(step => step.name === 'Install dependencies')
assert.ok(install > 0 && /- name: Install dependencies\r?\n\s+id: install\r?\n/.test(source), 'the install step has id: install')
const checks = steps.slice(install + 1)
assert.ok(checks.length >= 100, `the gate has its checks (${checks.length})`)
assert.equal(steps.filter(step => !step.uses && !step.run).length, 0, 'every step runs or uses something')
for (const step of checks) assert.equal(step.if, KEEP_GOING, `${step.name}: keeps going after an earlier failure`)
assert.equal(new Set(steps.map(step => step.name)).size, steps.length, 'step names are unique (the runner filters by name)')
const values = localExpressions({ repo: '/repo', base: 'b'.repeat(40), head: 'h'.repeat(40) })
for (const step of checks) {
  for (const text of [step.run, step.workingDirectory, ...Object.values(step.env)].filter(Boolean)) substituteExpressions(text, values)
}
console.log(`Source gate workflow: ${checks.length} checks keep going after a failure; every expression has a local value for npm run gate:source`)
