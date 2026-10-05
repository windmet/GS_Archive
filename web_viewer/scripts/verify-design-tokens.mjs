import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Ratchet: design drift may only shrink. Per file, count font sizes that bypass the
// --gs-text-* ladder or fall below the 12px floor, literal hex colors, and radii outside
// the shape roles. New or edited styles must use the tokens; lowering a count needs --update.
const root = fileURLToPath(new URL('..', import.meta.url))
const baselinePath = path.join(root, 'config/design-token-baseline.json')
const FLOOR_PX = 12
const update = process.argv.includes('--update')

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const file = path.join(dir, name)
    return statSync(file).isDirectory() ? walk(file) : /\.(vue|css)$/.test(name) ? [file] : []
  })
}

const METRICS = ['raw', 'tiny', 'hex', 'radius']

export function measure(source) {
  let raw = 0, tiny = 0, radius = 0
  for (const [, value] of source.matchAll(/font-size\s*:\s*([^;}\n]+)/g)) {
    const text = value.trim()
    if (/^var\(--gs-text-/.test(text)) continue
    const match = text.match(/^(\d*\.?\d+)(px|rem|em)\b/)
    if (!match) continue
    raw++
    const px = parseFloat(match[1]) * (match[2] === 'px' ? 1 : 16)
    if (px < FLOOR_PX) tiny++
  }
  // Shape follows role (media / control / float / pill); any other literal radius is drift.
  for (const [, value] of source.matchAll(/border-radius\s*:\s*([^;}\n]+)/g)) {
    if (!/^(?:0|50%|inherit|var\(--gs-radius-[a-z]+\))$/.test(value.trim())) radius++
  }
  // Colors come from the palette tokens; a literal hex is a private palette.
  const hex = [...source.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].filter(([text]) => [4, 5, 7, 9].includes(text.length)).length
  return { raw, tiny, hex, radius }
}

// Self-check so the counter cannot silently pass everything.
assert.deepEqual(measure('a{font-size:.6rem}b{font-size: 11px}c{font-size:var(--gs-text-meta)}d{font-size:13px}e{font-size:inherit}'), { raw: 3, tiny: 2, hex: 0, radius: 0 })
assert.deepEqual(measure('a{border-radius:6px;color:#13213a}b{border-radius:var(--gs-radius-control);background:#fff}c{border-radius:50%}d{border-radius:4px 4px 0 0}'), { raw: 0, tiny: 0, hex: 2, radius: 2 })

const current = {}
for (const file of walk(path.join(root, 'src'))) {
  const relative = path.relative(root, file).replaceAll('\\', '/')
  if (relative === 'src/styles/GS_UI_TOKENS.css') continue // the palette itself
  const counts = measure(readFileSync(file, 'utf8'))
  if (METRICS.some(key => counts[key])) current[relative] = counts
}

if (update) {
  writeFileSync(baselinePath, JSON.stringify(current, null, 2) + '\n')
  console.log(`Design tokens: baseline updated for ${Object.keys(current).length} files`)
} else {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
  const regressions = []
  let improved = 0
  const zero = Object.fromEntries(METRICS.map(key => [key, 0]))
  for (const [file, counts] of Object.entries(current)) {
    const allowed = { ...zero, ...baseline[file] }
    for (const key of METRICS) if (counts[key] > allowed[key]) regressions.push(`${file}: ${key} ${allowed[key]} -> ${counts[key]}`)
  }
  for (const [file, allowed] of Object.entries(baseline)) {
    const counts = current[file] || zero
    if (METRICS.some(key => counts[key] < (allowed[key] || 0))) improved++
  }
  assert.deepEqual(regressions, [], `Use the GS_UI_TOKENS palette, type ladder (floor ${FLOOR_PX}px) and radius roles:\n${regressions.join('\n')}`)
  const total = Object.values(current).reduce((sum, c) => Object.fromEntries(METRICS.map(key => [key, sum[key] + c[key]])), zero)
  console.log(`Design tokens: ${total.raw} literal font sizes (${total.tiny} below ${FLOOR_PX}px), ${total.hex} hex colors, ${total.radius} literal radii remain; none added${improved ? ` (${improved} files improved; run --update to lock in)` : ''}`)
}
