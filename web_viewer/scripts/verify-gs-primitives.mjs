import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { segmentedNextIndex } from '../src/presentation/GsSegmentedKeys.mjs'
import { groupConsoleIdols } from '../src/presentation/HomeConsole.js'
import { groupSongTiers } from '../src/presentation/SongTiers.js'

// P0 of the program-booklet 2.0 redesign: the v2 token increment and the four base components
// (GsSegmented, GsRow, GsSwitch, GsInfo). Components may only read tokens that exist, so a
// misspelled variable cannot fall through to the browser default.
const root = fileURLToPath(new URL('..', import.meta.url))
const tokens = readFileSync(path.join(root, 'src/styles/GS_UI_TOKENS.css'), 'utf8')
const defined = new Set([...tokens.matchAll(/(--gs-[a-z0-9-]+)\s*:/g)].map(match => match[1]))

const V2_TOKENS = [
  '--gs-paper-2', '--gs-console', '--gs-shadow-1', '--gs-shadow-console',
  '--gs-gap-inline', '--gs-gap-stack', '--gs-gap-group', '--gs-gap-section', '--gs-pad-panel', '--gs-row', '--gs-gutter',
  '--gs-reading-width', '--gs-rail-width', '--gs-tool-panel', '--gs-tool-panel-compact', '--gs-tool-bar',
  '--gs-text-figure', '--gs-leading-body', '--gs-leading-ui', '--gs-track-label',
  '--gs-mode-track', '--gs-mode-thumb', '--gs-mode-ink', '--gs-radius-segment', '--gs-switch-on', '--gs-switch-off',
  '--gs-current-bg', '--gs-current-shadow', '--gs-current-bg-inset', '--gs-current-motion', '--gs-hover', '--gs-ring-group',
  '--gs-idol', '--gs-idol-light', '--gs-idol-ink', '--gs-idol-wash',
  '--gs-stage-bg', '--gs-stage-raise', '--gs-stage-line', '--gs-stage-ink', '--gs-stage-ink-2', '--gs-stage-track', '--gs-stage-thumb',
]
assert.deepEqual(V2_TOKENS.filter(name => !defined.has(name)), [], 'v2 tokens missing from GS_UI_TOKENS.css')
assert.equal([...tokens.matchAll(/^\s*--gs-idol\s*:/gm)].length, 1, '--gs-idol must be defined once (neutral default); idols set it at runtime')

const dir = path.join(root, 'src/components/gs')
const files = readdirSync(dir).filter(name => name.endsWith('.vue')).sort()
// P1.6 added GsFilterMenu (the many-values filter that replaced native selects); 线框减法册 L4 added GsTabs (underline
// tabs for 3–5 categories); L7 added GsChoice (the 2–3 value text toggle). They meet the same rules.
assert.deepEqual(files, ['GsChoice.vue', 'GsFilterMenu.vue', 'GsInfo.vue', 'GsRow.vue', 'GsSegmented.vue', 'GsSwitch.vue', 'GsTabs.vue'])
for (const file of files) {
  const source = readFileSync(path.join(dir, file), 'utf8')
  const used = [...source.matchAll(/var\((--gs-[a-z0-9-]+)/g)].map(match => match[1])
  assert.ok(used.length > 5, `${file} should be styled by tokens`)
  const local = new Set([...source.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(match => match[1]))
  assert.deepEqual([...new Set(used)].filter(name => !defined.has(name) && !local.has(name)), [], `${file} reads undefined tokens`)
  assert.equal([...source.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].length, 0, `${file} must not carry literal colours`)
  assert.ok(/prefers-reduced-motion/.test(source) || !/transition/.test(source), `${file} animates without a reduced-motion rule`)
}
// Nothing imports the primitives yet (P1 onwards will), so the build would never compile them.
const { parse, compileScript, compileStyle } = await import('@vue/compiler-sfc')
for (const file of files) {
  const { descriptor, errors } = parse(readFileSync(path.join(dir, file), 'utf8'), { filename: file })
  assert.deepEqual(errors, [], `${file} does not parse`)
  compileScript(descriptor, { id: file })
  for (const style of descriptor.styles) assert.deepEqual(compileStyle({ source: style.content, filename: file, id: 'gs', scoped: true }).errors, [], `${file} style`)
}
const read = file => readFileSync(path.join(dir, file), 'utf8')
assert.match(read('GsSwitch.vue'), /role="switch"/)
assert.match(read('GsSegmented.vue'), /role="radiogroup"/)
assert.match(read('GsInfo.vue'), /role="tooltip"/)
// The ⓘ bubble positions itself once, in the top layer at viewport coordinates; a page that moves
// it locally (top / left / transform on .gs-info-bubble) brings back the clipped-bubble bugs.
assert.match(read('GsInfo.vue'), /popover="manual"/, 'the info bubble opens in the top layer')
assert.match(read('GsInfo.vue'), /floatingOverlayPosition\(/, 'the info bubble is clamped to the viewport by the shared helper')
{
  const src = path.join(dir, '..', '..')
  const walkFiles = folder => readdirSync(folder, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walkFiles(path.join(folder, entry.name)) : /\.(vue|css)$/.test(entry.name) ? [path.join(folder, entry.name)] : [])
  const local = walkFiles(src).filter(file => !file.endsWith(`${path.sep}GsInfo.vue`) && /gs-info-bubble/.test(readFileSync(file, 'utf8')))
  assert.deepEqual(local.map(file => path.relative(src, file).replaceAll(path.sep, '/')), [], 'only GsInfo styles its bubble')
}
assert.match(read('GsSwitch.vue'), /ariaLabel: \{ type: String, required: true \}/, 'a switch has no text: its label is mandatory')
assert.match(read('GsTabs.vue'), /ariaLabel: \{ type: String, required: true \}/, 'a tab row names its group')
assert.match(read('GsTabs.vue'), /:aria-pressed="option\.value === modelValue"/, 'the current tab is announced')

// Keyboard model of the mode switch: arrows wrap, disabled segments are skipped.
const opts = values => values.map(value => ({ value, disabled: value === 'x' }))
assert.equal(segmentedNextIndex(opts(['a', 'b', 'c']), 0, 'ArrowRight'), 1)
assert.equal(segmentedNextIndex(opts(['a', 'b', 'c']), 2, 'ArrowRight'), 0, 'wraps forward')
assert.equal(segmentedNextIndex(opts(['a', 'b', 'c']), 0, 'ArrowLeft'), 2, 'wraps backward')
assert.equal(segmentedNextIndex(opts(['a', 'x', 'c']), 0, 'ArrowRight'), 2, 'skips a disabled segment')
assert.equal(segmentedNextIndex(opts(['x', 'b', 'c']), 2, 'End'), 2)
assert.equal(segmentedNextIndex(opts(['x', 'b', 'c']), 2, 'Home'), 1, 'Home lands on the first enabled segment')
assert.equal(segmentedNextIndex(opts(['x', 'x']), 0, 'ArrowRight'), -1, 'nothing selectable')
assert.equal(segmentedNextIndex(opts(['a', 'b']), 0, 'Enter'), -1, 'other keys are ignored')
assert.equal(segmentedNextIndex([], 0, 'ArrowRight'), -1)
// 事务所 console idol list: grouped by unit in roster order, searched by full name, kana or unit.
const roster = [{ id: 'a', name: '天瀬冬馬', kana: 'あまがせ とうま', unitName: 'Jupiter' }, { id: 'b', name: '御手洗翔太', kana: 'みたらい しょうた', unitName: 'Jupiter' }, { id: 'c', name: '天道輝', kana: 'てんどう てる', unitName: 'DRAMATIC STARS' }]
const shown = idol => ({ a: '天濑冬马' })[idol.id] || idol.name
assert.deepEqual(groupConsoleIdols(roster, shown).map(group => [group.unit, group.idols.map(idol => idol.id)]), [['Jupiter', ['a', 'b']], ['DRAMATIC STARS', ['c']]])
assert.deepEqual(groupConsoleIdols(roster, shown, '濑').map(group => group.idols.map(idol => idol.id)), [['a']], 'matches the displayed (translated) name')
assert.deepEqual(groupConsoleIdols(roster, shown, 'しょうた').flatMap(group => group.idols.map(idol => idol.id)), ['b'], 'matches kana')
assert.deepEqual(groupConsoleIdols(roster, shown, 'jupiter').flatMap(group => group.idols.map(idol => idol.id)), ['a', 'b'], 'a unit name keeps the whole unit')
assert.deepEqual(groupConsoleIdols(roster, shown, '没有'), [])
// Song overview tiers: lineups are sections; units keep the game's order, songs their own.
{
  // Catalog JSON names the unit in performance_mapping.confirmed_unit; read-model rows only as performance.unitName.
  const song = (code, kind, unit) => ({ song_code: code, kind, performance_mapping: unit ? { confirmed_unit: unit } : {} })
  const modelRow = (code, unitName) => ({ song_code: code, kind: 'fixed_unit', performance: { unitName } })
  const rows = [song('a', 'fixed_unit', { unit_id: 9, unit_code: '09shi', unit_name: '神速一魂' }), song('b', 'configurable_formation'), modelRow('c', 'Jupiter'), song('d', 'fixed_special_lineup'), modelRow('e', '神速一魂')]
  const tiers = groupSongTiers(rows, row => row.kind)
  assert.deepEqual(tiers.featured.map(row => row.song_code), ['b'])
  assert.deepEqual(tiers.special.map(row => row.song_code), ['d'])
  assert.deepEqual(tiers.units.map(unit => [unit.code, unit.songs.map(row => row.song_code)]), [['01jup', ['c']], ['09shi', ['a', 'e']]], 'unit order, then song order')
  assert.equal(tiers.unitSongCount, 3)
  assert.deepEqual(groupSongTiers([], () => 'fixed_unit'), { featured: [], units: [], unitSongCount: 0, special: [] })
}
console.log(`GS primitives: ${V2_TOKENS.length} v2 tokens, ${files.length} components, keyboard model ok`)
