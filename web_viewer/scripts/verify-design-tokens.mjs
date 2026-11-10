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

const METRICS = ['raw', 'tiny', 'hex', 'radius', 'breakpoint', 'nestedWhite', 'hoverUngated', 'motionLiteral', 'select', 'checkbox']
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

// Input rule (docs/GS_UI_MOTION_INTERACTION_AUDIT_20261110, 2.1): a :hover rule that only changes the look belongs in
// @media (hover: hover). Touch devices keep :hover after a tap, which reads as "selected". Counted per rule, walking a
// brace stack so the ancestors' at-rules are known; only <style> blocks of .vue files are read (offsets masked, not cut).
const HOVER_GATE = /@media[^{]*\(\s*(?:any-)?hover\s*:\s*hover\s*\)/
export function hoverUngated(source, isVue) {
  let text = source
  if (isVue) {
    const styles = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    if (!styles.length) return 0
    text = source.replace(/[^\n]/g, ' ')
    for (const style of styles) {
      const start = style.index + style[0].indexOf(style[1])
      text = text.slice(0, start) + style[1] + text.slice(start + style[1].length)
    }
  }
  text = text.replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, ' '))
  const stack = []
  let buffer = '', count = 0
  for (const char of text) {
    if (char === '{') {
      const prelude = buffer.trim()
      stack.push(prelude)
      if (/:hover/.test(prelude) && !prelude.startsWith('@') && !stack.some(entry => HOVER_GATE.test(entry))) count++
      buffer = ''
    } else if (char === '}') { stack.pop(); buffer = '' }
    else if (char === ';') buffer = ''
    else buffer += char
  }
  return count
}

// Motion ladder (gs-motion.css): a transition or animation takes its duration and curve from the --gs-motion-* /
// --gs-ease-* tokens. A literal duration or a bare ease/linear keyword is drift. steps() and 0s are not durations.
// gs-motion.css is the ladder itself; TitleUI.vue is the native title sequence, timed by its own --duration.
const MOTION_LITERAL_EXEMPT = new Set(['src/styles/gs-motion.css', 'src/components/TitleUI.vue'])
export function motionLiteral(source, relative = '') {
  if (MOTION_LITERAL_EXEMPT.has(relative)) return 0
  let count = 0
  for (const [, value] of source.matchAll(/(?:^|[;{\s])(?:transition|animation)(?:-duration|-timing-function)?\s*:\s*([^;}]*)/g)) {
    const text = value.replace(/steps\([^)]*\)/g, '').replace(/cubic-bezier\([^)]*\)/g, '')
    if (/(?<![\w.-])(?:\d*\.\d*[1-9]\d*|[1-9]\d*\.?\d*)m?s\b/.test(text) || /(?<![\w-])(?:ease|ease-in|ease-out|ease-in-out|linear)(?![\w-])/.test(text)) count++
  }
  return count
}

export function measure(source, relative = '') {
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
  return { raw, tiny, hex, radius, breakpoint, nestedWhite: nestedWhite(source), hoverUngated: hoverUngated(source, relative.endsWith('.vue')), motionLiteral: motionLiteral(source, relative) }
}

// Native controls in the archive UI (components/archive, Chibi*): a <select> becomes the person picker, filter chips or the
// filter menu; a checkbox becomes GsSwitch. Counted per file, only down. The settings panel keeps long option
// lists in plain GsRow selects, so it is the one whitelisted file.
const NATIVE_CONTROL_SCOPE = /^src\/components\/(?:archive\/|Chibi[^/]*\.vue$)/
const NATIVE_CONTROL_WHITELIST = new Set(['src/components/archive/ArchiveProducerSettings.vue'])
export function nativeControls(source, relative) {
  if (!NATIVE_CONTROL_SCOPE.test(relative) || NATIVE_CONTROL_WHITELIST.has(relative)) return { select: 0, checkbox: 0 }
  const template = source.match(/<template[\s\S]*<\/template>/)?.[0] || ''
  return { select: (template.match(/<select[\s>]/g) || []).length, checkbox: (template.match(/<input\s[^>]*\btype=["']checkbox["']/g) || []).length }
}
assert.deepEqual(nativeControls('<template><select v-model="a"></select><label><input v-model="b" type="checkbox"/></label><input type="text"/></template>', 'src/components/archive/X.vue'), { select: 1, checkbox: 1 })
assert.deepEqual(nativeControls('<template><select></select></template>', 'src/components/gs/Y.vue'), { select: 0, checkbox: 0 })
assert.deepEqual(nativeControls('<template><select></select></template>', 'src/components/archive/ArchiveProducerSettings.vue'), { select: 0, checkbox: 0 })

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
assert.deepEqual(measure('a{font-size:.6rem}b{font-size: 11px}c{font-size:var(--gs-text-meta)}d{font-size:13px}e{font-size:inherit}'), { raw: 3, tiny: 2, hex: 0, radius: 0, breakpoint: 0, nestedWhite: 0, hoverUngated: 0, motionLiteral: 0 })
assert.deepEqual(measure('a{border-radius:6px;color:#13213a}b{border-radius:var(--gs-radius-control);background:#fff}c{border-radius:50%}d{border-radius:4px 4px 0 0}'), { raw: 0, tiny: 0, hex: 2, radius: 2, breakpoint: 0, nestedWhite: 0, hoverUngated: 0, motionLiteral: 0 })
assert.deepEqual(measure('@media (max-width: 760px), (pointer:coarse){}@media(min-width:761px) and (max-width:1100px){}@media (max-height: 600px){}@container (max-width: 520px){}@media (max-width: 700px){}@media (min-width:1101px) and (max-width:40em){}').breakpoint, 2)

// Hover and motion counters: gated rules, other at-rules and comments must not count; literals must.
assert.equal(hoverUngated('a:hover{color:red}@media (hover: hover) and (pointer: fine){b:hover{color:red}@supports (x:y){c:hover{x:y}}}@media (max-width:760px){d:hover{x:y}}/* e:hover{x:y} */'), 2)
assert.equal(hoverUngated('<template><a class="x:hover"></a></template><style>.a:hover{x:y}@media (any-hover: hover){.b:hover{x:y}}</style>', true), 1)
assert.equal(hoverUngated('<template>a:hover{x:y}</template>', true), 0)
assert.equal(motionLiteral('a{transition: opacity 120ms var(--gs-ease-out)}b{transition: color var(--gs-motion-feedback) var(--gs-ease-out)}c{animation: x .4s ease}d{transition: transform var(--t, 200ms) ease}e{animation: x var(--gs-motion-enter) steps(4) 0s}f{animation-timing-function: linear}g{transition: opacity var(--gs-motion-enter) cubic-bezier(.2,.7,.2,1)}'), 4)
assert.equal(motionLiteral('a{transition: opacity 120ms ease}', 'src/styles/gs-motion.css'), 0)

// 线框减法册 rule 2: a segmented switch holds at most three values (more go to GsTabs or GsFilterMenu). The options are
// an inline array or a same-file `const NAME = [...]` / `computed(() => [...])`; anything else cannot be counted and fails.
const SEGMENTED_MAX = 3
function topLevelObjects(text, open) {
  let depth = 0, count = 0
  for (let index = open; index < text.length; index++) {
    const char = text[index]
    if (char === '[' || char === '{' || char === '(') { if (char === '{' && depth === 1) count++; depth++ }
    else if (char === ']' || char === '}' || char === ')') { depth--; if (depth === 0) return count }
  }
  return null
}
export function segmentedOverflow(source) {
  const found = []
  for (const [tag] of source.matchAll(/<GsSegmented\b[^>]*>/g)) {
    const binding = tag.match(/:options="([^"]+)"/)?.[1]?.trim()
    let count = null
    if (binding?.startsWith('[')) count = topLevelObjects(binding, 0)
    else if (/^[A-Za-z_$][\w$]*$/.test(binding || '')) {
      const declaration = source.match(new RegExp(`const ${binding}\\s*=\\s*(?:computed\\(\\(\\)\\s*=>\\s*)?\\[`))
      if (declaration) count = topLevelObjects(source, declaration.index + declaration[0].length - 1)
    }
    if (count === null || count > SEGMENTED_MAX) found.push(`${binding || '(no options)'}: ${count ?? 'not countable'}`)
  }
  return found
}
assert.deepEqual(segmentedOverflow('<GsSegmented :options="OPTS" /><script>const OPTS = [{ value: 1 }, { value: 2 }, { value: 3 }]</script>'), [])
assert.deepEqual(segmentedOverflow('<GsSegmented :options="OPTS" /><script>const OPTS = computed(() => [{ a: 1 }, { a: { b: 2 } }, { a: 3 }, { a: 4 }])</script>'), ['OPTS: 4'])
assert.deepEqual(segmentedOverflow('<GsSegmented :options="[{ value: 1 }, { value: 2 }]" />'), [])
assert.deepEqual(segmentedOverflow('<GsSegmented :options="props.list" />'), ['props.list: not countable'])

const current = {}
const inkMisuse = []
const segmentedMisuse = []
for (const file of walk(path.join(root, 'src'))) {
  const relative = path.relative(root, file).replaceAll('\\', '/')
  if (relative === 'src/styles/GS_UI_TOKENS.css') continue // the palette itself
  const source = readFileSync(file, 'utf8')
  const counts = { ...measure(source, relative), ...nativeControls(source, relative) }
  if (METRICS.some(key => counts[key])) current[relative] = counts
  for (const property of inkFills(source)) inkMisuse.push(`${relative}: ${property}`)
  for (const overflow of segmentedOverflow(source)) segmentedMisuse.push(`${relative}: ${overflow}`)
}
assert.deepEqual(segmentedMisuse, [], `GsSegmented holds at most ${SEGMENTED_MAX} values; use GsTabs or GsFilterMenu:\n${segmentedMisuse.join('\n')}`)
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
  console.log(`Design tokens: ${total.raw} literal font sizes (${total.tiny} below ${FLOOR_PX}px), ${total.hex} hex colors, ${total.radius} literal radii, ${total.breakpoint} off-tier breakpoints, ${total.hoverUngated} ungated :hover rules, ${total.motionLiteral} literal motion declarations remain; none added${improved ? ` (${improved} files improved; run --update to lock in)` : ''}`)
}
