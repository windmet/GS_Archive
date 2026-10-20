import { readFileSync } from 'node:fs'

// Reads the steps of .github/workflows/web-viewer-source-gate.yml, so the local runner (scripts/run-source-gate.mjs)
// and its verifier run exactly what CI runs. Only the shapes this workflow uses are understood: `- name:` steps
// with `uses:` or `run:` (inline, `|` block or `>-` folded), and optional `working-directory:`, `env:` and `if:`.
export const SOURCE_GATE_WORKFLOW = new URL('../../../.github/workflows/web-viewer-source-gate.yml', import.meta.url)

function blockScalar(lines, start, indent, folded) {
  const body = []
  let i = start
  for (; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() && line.search(/\S/) <= indent) break
    body.push(line.trim() ? line.slice(indent + 2) : '')
  }
  while (body.length && !body.at(-1)) body.pop()
  return { text: folded ? body.join(' ').replace(/\s+/g, ' ').trim() : body.join('\n'), next: i }
}

export function parseSourceGateSteps(source = readFileSync(SOURCE_GATE_WORKFLOW, 'utf8')) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const start = lines.findIndex(line => /^\s+steps:\s*$/.test(line))
  if (start < 0) throw new Error('No steps: in the source gate workflow')
  const steps = []
  let step = null
  for (let i = start + 1; i < lines.length;) {
    const line = lines[i]
    const item = /^(\s*)- name:\s*(.+)$/.exec(line)
    if (item) {
      step = { name: item[2].trim(), indent: item[1].length + 2, env: {} }
      steps.push(step)
      i++
      continue
    }
    const field = step && new RegExp(`^ {${step.indent}}([a-z-]+):\\s*(.*)$`).exec(line)
    if (!field) { i++; continue }
    const [, key, value] = field
    if (key === 'run' && (value === '|' || value === '>-')) {
      const block = blockScalar(lines, i + 1, step.indent, value === '>-')
      step.run = block.text
      i = block.next
      continue
    }
    if (key === 'env') {
      for (i++; i < lines.length; i++) {
        const entry = new RegExp(`^ {${step.indent + 2}}([A-Z_][A-Z0-9_]*):\\s*(.*)$`).exec(lines[i])
        if (!entry) break
        step.env[entry[1]] = entry[2].trim()
      }
      continue
    }
    if (key === 'run') step.run = value
    else if (key === 'working-directory') step.workingDirectory = value
    else if (key === 'uses') step.uses = value
    else if (key === 'if') step.if = value
    i++
  }
  return steps.map(({ indent, ...rest }) => rest)
}

// GitHub expressions the workflow uses, given their local meaning; any other expression is an error, so a new one
// cannot silently run as an empty string.
export function substituteExpressions(text, values) {
  return text.replace(/\$\{\{\s*([^}]+?)\s*\}\}/g, (_, expression) => {
    if (!(expression in values)) throw new Error(`No local value for \${{ ${expression} }}`)
    return values[expression]
  })
}

// The local meaning of every expression the run, env and working-directory fields use.
export function localExpressions({ repo, base, head }) {
  return {
    'github.workspace': repo,
    'github.event.pull_request.base.sha || github.event.before': base,
    'github.event.pull_request.head.sha || github.sha': head,
  }
}

// Steps after the install keep running after a failure (the job still fails), so one push reports every failure.
export const KEEP_GOING = "${{ !cancelled() && steps.install.outcome == 'success' }}"
