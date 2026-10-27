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

const METRICS = ['raw', 'tiny', 'hex', 'radius', 'breakpoint', 'nestedWhite']
// Viewport tiers: phone <=760 (where the sidebar becomes the bottom nav), middle 761-1100,
// wide >1100. Anything finer belongs to the component as an @container query.
const TIER_WIDTHS = { max: ['760', '1100'], min: ['761', '1101'] }

// Box budget: one white console per area. A white-filled rule whose selector sits under another
// white-filled rule's element (same file) is a white box inside a white box. Static approximation:
// rules are matched by their last compound selector, so nesting across files is not seen.
const WHITE_FILL = /(?:^|[;\s])background(?:-color)?\s*:\s*(?:var\(--gs-(?:surface|console|current-bg)\)|#fff(?:fff)?\b|white\b)/
const compound = token => token.replace(/::?[a-z-]+(?:\([^)]*\))?/gi, '')
export function nestedWhite(source) {
  const styles = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n')
  const css = styles || (source.includes('<template') ? '' : source)
  const whites = []
  for (const [, selectors, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!WHITE_FILL.test(`;${body}`)) continue
    for (const selector of selectors.split(',')) {
      const tokens = selector.trim().split(/\s*[>+~]\s*|\s+/).map(compound).filter(Boolean)
      if (tokens.length) whites.push(tokens)
    }
  }
  const owners = new Set(whites.map(tokens => tokens.at(-1)))
  return whites.filter(tokens => tokens.slice(0, -1).some(ancestor => owners.has(ancestor))).length
}

export function measure(source) {
  let raw = 0, tiny = 0, radius = 0, breakpoint = 0
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
  for (const [prelude] of source.matchAll(/@media[^{]*/g)) {
    const widths = [...prelude.matchAll(/\((max|min)-width\s*:\s*([^)]+)\)/g)]
    if (widths.some(([, kind, value]) => !TIER_WIDTHS[kind].includes(value.trim().replace(/px$/, '')))) breakpoint++
  }
  return { raw, tiny, hex, radius, breakpoint, nestedWhite: nestedWhite(source) }
}

// Hard rule, not a ratchet: --gs-ink is for text. Fills, borders and rules use the role
// tokens (--gs-selected-*, --gs-action-*, --gs-play-*, --gs-rule), so solid navy cannot
// creep back into chips and tabs.
export function inkFills(source) {
  return [...source.matchAll(/(?:^|[;{\s])((?:background|border|outline|box-shadow)[a-z-]*)\s*:[^;}\n]*var\(--gs-ink\)/g)].map(match => match[1])
}
assert.deepEqual(inkFills('a{color:var(--gs-ink);--x:var(--gs-ink)}b{background:var(--gs-ink)}c{border-bottom:1px solid var(--gs-ink);border-color:var(--gs-ink-2)}d{box-shadow:inset 0 0 0 1px var(--gs-ink)}'), ['background', 'border-bottom', 'box-shadow'])

// Self-check so the counters cannot silently pass everything.
assert.equal(nestedWhite('<style>.panel{background:var(--gs-surface)}.panel .cell{background:#fff}.panel .tag{background:var(--gs-paper)}</style>'), 1)
assert.equal(nestedWhite('<style>.panel{background:var(--gs-surface)}.cell{background:var(--gs-surface)}.panel>.row:hover{background:white}</style>'), 1)
assert.equal(nestedWhite('<style>.a{background:var(--gs-surface)}.b .c{background:var(--gs-paper-2)}@media (max-width:760px){.a .d{background:var(--gs-current-bg)}}</style>'), 1)
assert.equal(nestedWhite('<style>.a{background:var(--gs-surface)}.b{background:var(--gs-surface)}</style>'), 0)
assert.equal(nestedWhite('<template><div style="background:#fff"></div></template>'), 0)
assert.deepEqual(measure('a{font-size:.6rem}b{font-size: 11px}c{font-size:var(--gs-text-meta)}d{font-size:13px}e{font-size:inherit}'), { raw: 3, tiny: 2, hex: 0, radius: 0, breakpoint: 0, nestedWhite: 0 })
assert.deepEqual(measure('a{border-radius:6px;color:#13213a}b{border-radius:var(--gs-radius-control);background:#fff}c{border-radius:50%}d{border-radius:4px 4px 0 0}'), { raw: 0, tiny: 0, hex: 2, radius: 2, breakpoint: 0, nestedWhite: 0 })
assert.deepEqual(measure('@media (max-width: 760px), (pointer:coarse){}@media(min-width:761px) and (max-width:1100px){}@media (max-height: 600px){}@container (max-width: 520px){}@media (max-width: 700px){}@media (min-width:1101px) and (max-width:40em){}').breakpoint, 2)

const current = {}
const inkMisuse = []
for (const file of walk(path.join(root, 'src'))) {
  const relative = path.relative(root, file).replaceAll('\\', '/')
  if (relative === 'src/styles/GS_UI_TOKENS.css') continue // the palette itself
  const source = readFileSync(file, 'utf8')
  const counts = measure(source)
  if (METRICS.some(key => counts[key])) current[relative] = counts
  for (const property of inkFills(source)) inkMisuse.push(`${relative}: ${property}`)
}
assert.deepEqual(inkMisuse, [], `--gs-ink is for text; use --gs-selected-*, --gs-action-*, --gs-play-* or --gs-rule:\n${inkMisuse.join('\n')}`)

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
  console.log(`Design tokens: ${total.raw} literal font sizes (${total.tiny} below ${FLOOR_PX}px), ${total.hex} hex colors, ${total.radius} literal radii, ${total.breakpoint} off-tier breakpoints remain; none added${improved ? ` (${improved} files improved; run --update to lock in)` : ''}`)
}
