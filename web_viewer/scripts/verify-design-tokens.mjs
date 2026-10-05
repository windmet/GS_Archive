import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Ratchet: type-scale drift may only shrink. Per file, count font-size declarations that
// (a) bypass the --gs-text-* tokens and (b) render below the readable floor (11px).
// New or edited styles must use the tokens; lowering a count requires --update.
const root = fileURLToPath(new URL('..', import.meta.url))
const baselinePath = path.join(root, 'config/design-token-baseline.json')
const FLOOR_PX = 11
const update = process.argv.includes('--update')

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const file = path.join(dir, name)
    return statSync(file).isDirectory() ? walk(file) : /\.(vue|css)$/.test(name) ? [file] : []
  })
}

export function measure(source) {
  let raw = 0, tiny = 0
  for (const [, value] of source.matchAll(/font-size\s*:\s*([^;}\n]+)/g)) {
    const text = value.trim()
    if (/^var\(--gs-text-/.test(text)) continue
    const match = text.match(/^(\d*\.?\d+)(px|rem|em)\b/)
    if (!match) continue
    raw++
    const px = parseFloat(match[1]) * (match[2] === 'px' ? 1 : 16)
    if (px < FLOOR_PX) tiny++
  }
  return { raw, tiny }
}

// Self-check so the counter cannot silently pass everything.
assert.deepEqual(measure('a{font-size:.6rem}b{font-size: 10px}c{font-size:var(--gs-text-meta)}d{font-size:13px}e{font-size:inherit}'), { raw: 3, tiny: 2 })

const current = {}
for (const file of walk(path.join(root, 'src'))) {
  const counts = measure(readFileSync(file, 'utf8'))
  if (counts.raw || counts.tiny) current[path.relative(root, file).replaceAll('\\', '/')] = counts
}

if (update) {
  writeFileSync(baselinePath, JSON.stringify(current, null, 2) + '\n')
  console.log(`Design tokens: baseline updated for ${Object.keys(current).length} files`)
} else {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
  const regressions = []
  let improved = 0
  for (const [file, counts] of Object.entries(current)) {
    const allowed = baseline[file] || { raw: 0, tiny: 0 }
    for (const key of ['raw', 'tiny']) if (counts[key] > allowed[key]) regressions.push(`${file}: ${key} ${allowed[key]} -> ${counts[key]}`)
  }
  for (const [file, allowed] of Object.entries(baseline)) {
    const counts = current[file] || { raw: 0, tiny: 0 }
    if (counts.raw < allowed.raw || counts.tiny < allowed.tiny) improved++
  }
  assert.deepEqual(regressions, [], `Use var(--gs-text-*) tokens (floor ${FLOOR_PX}px):\n${regressions.join('\n')}`)
  const total = Object.values(current).reduce((sum, c) => ({ raw: sum.raw + c.raw, tiny: sum.tiny + c.tiny }), { raw: 0, tiny: 0 })
  console.log(`Design tokens: ${total.raw} literal and ${total.tiny} sub-${FLOOR_PX}px font sizes remain, none added${improved ? ` (${improved} files improved; run --update to lock in)` : ''}`)
}
