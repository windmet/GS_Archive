import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import * as Vue from 'vue'
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc'
import * as libraryHelpers from '../src/presentation/ChibiSongLibrary.js'

const filename = 'src/components/ChibiSongPicker.vue'
const { descriptor, errors } = parse(fs.readFileSync(filename, 'utf8'), { filename })
assert.deepEqual(errors, [])
for (const style of descriptor.styles) assert.deepEqual(compileStyle({ id: 'song-picker-qa', source: style.content, scoped: true }).errors, [])
const source = compileScript(descriptor, { id: 'song-picker-qa', inlineTemplate: true }).content
const rawSongs = JSON.parse(fs.readFileSync('public/assets/live-chibi/choreography/index.json', 'utf8')).songs
const directory = JSON.parse(fs.readFileSync('public/data/song_catalog.json', 'utf8'))
const library = libraryHelpers.buildStageSongLibrary(rawSongs, directory)

const node = (type, value = '') => {
  const item = { type, text: value, props: {}, style: { display: '' }, children: [], parent: null, events: {}, value: '', composing: false }
  if (type === 'select') {
    let selectedIndex = -1
    item.multiple = false
    Object.defineProperties(item, {
      options: { get: () => all(item).filter(child => child.type === 'option') },
      selectedIndex: { get: () => selectedIndex, set: index => {
        selectedIndex = index
        item.options.forEach((option, optionIndex) => { option.selected = optionIndex === index })
      } },
      value: { get: () => item.options[selectedIndex]?.value || '', set: next => {
        item.selectedIndex = item.options.findIndex(option => option.value === next)
      } },
    })
  }
  item.addEventListener = (name, fn) => { item.events[name] = fn }
  item.removeEventListener = name => { delete item.events[name] }
  return item
}
const remove = item => {
  if (item.parent) item.parent.children.splice(item.parent.children.indexOf(item), 1)
  item.parent = null
}
const renderer = Vue.createRenderer({
  createElement: type => node(type), createText: value => node('#text', value), createComment: value => node('#comment', value),
  setText: (item, value) => { item.text = value }, setElementText: (item, value) => { item.text = value; item.children = [] },
  patchProp: (item, key, _previous, value) => { item.props[key] = value; if (key === 'value') item.value = value },
  insert(item, parent, anchor = null) {
    remove(item); const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, item); item.parent = parent
  },
  remove, parentNode: item => item.parent, nextSibling: item => item.parent?.children[item.parent.children.indexOf(item) + 1] || null,
})
const all = root => [root, ...root.children.flatMap(all)]
const text = root => root.text + root.children.map(text).join('')
const hasClass = (item, name) => String(item.props.class || '').split(/\s/u).includes(name)
const imports = {
  vue: Vue,
  '@lucide/vue': Object.fromEntries(['Music2', 'Search'].map(name => [name, { render: () => null }])),
  '../presentation/ChibiSongLibrary.js': libraryHelpers,
}
const context = vm.createContext({ console })
const module = new vm.SourceTextModule(source, { context })
await module.link(specifier => {
  assert.ok(imports[specifier], `unexpected import ${specifier}`)
  const values = imports[specifier]
  return new vm.SyntheticModule(Object.keys(values), function () {
    for (const [name, value] of Object.entries(values)) this.setExport(name, value)
  }, { context })
})
await module.evaluate()
const Picker = module.namespace.default
const flush = async () => { await Vue.nextTick(); await Vue.nextTick() }
const root = node('root'), emits = []
const state = Vue.shallowReactive({ songs: rawSongs, songDirectory: directory, selectedSongId: 'drvalv_live_effect_01jup', disabled: false })
const app = renderer.createApp({ render: () => Vue.h(Picker,
  { ...state, onSelectSong: id => { emits.push(id); state.selectedSongId = id } },
  { default: () => Vue.h('fieldset', { class: 'audio-slot-probe' }, '原唱 / 编成试听'),
    'current-actions': () => Vue.h('button', { class: 'current-action-slot-probe', 'aria-label': '声音' }, '声音') }) })
app.config.warnHandler = message => assert.fail(message)
app.mount(root)
await flush()
const find = pred => all(root).find(pred)
const buttons = () => all(root).filter(item => item.type === 'button')
const rows = () => buttons().filter(item => hasClass(item, 'song-row'))
const search = () => find(item => item.type === 'input' && item.props.type === 'search')
const query = async value => { const field = search(); field.value = value; field.events.input({ target: field }); await flush() }
const versionSelect = () => find(item => item.type === 'select' && item.props['aria-label'] === '演出编排版本')
const categorySelect = () => find(item => item.type === 'select' && item.props['aria-label'] === '舞台歌曲分类')
const selectVersion = async value => { versionSelect().props.onChange({ target: { value } }); await flush() }
const selectCategory = async value => {
  const field = categorySelect()
  field.value = value
  field.events.change({ target: field })
  await flush()
}
const assertDisplayed = item => {
  assert.ok(item)
  for (let ancestor = item; ancestor; ancestor = ancestor.parent) assert.notEqual(ancestor.style.display, 'none')
}
const assertCurrentSongBadge = () => {
  const selected = libraryHelpers.findStageSongGroup(library, state.selectedSongId)
  const currentRow = rows().find(row => row.props['data-song-code'] === selected?.songCode)
  const badges = rows().flatMap(row => all(row).filter(item => hasClass(item, 'song-current-badge')))
  assert.equal(badges.length, currentRow ? 1 : 0, 'only the visible exact selected song receives a current-song badge')
  if (currentRow) {
    assert.equal(text(badges[0]), '当前曲目', 'selection status does not imply that the stage is playing')
    const titleLine = all(currentRow).find(item => hasClass(item, 'song-row-title'))
    assert.ok(titleLine.children.includes(badges[0]), 'current badge belongs to the title line')
    assert.equal(currentRow.props['aria-pressed'], true)
  }
}
const assertPermanentSections = (selected = true) => {
  const current = find(item => hasClass(item, 'song-current'))
  const songLibrary = find(item => hasClass(item, 'song-library'))
  assertDisplayed(current)
  assertDisplayed(songLibrary)
  assert.equal(find(item => item.type === 'details' || item.type === 'summary'), undefined, 'song library has no accordion')
  const pickerChildren = find(item => hasClass(item, 'chibi-song-picker')).children
  assert.ok(pickerChildren.indexOf(current) < pickerChildren.indexOf(songLibrary), 'current song and arrangement precede the permanent library')
  if (selected) {
    assertDisplayed(find(item => hasClass(item, 'stage-arrangement')))
    const action = find(item => hasClass(item, 'current-action-slot-probe'))
    assertDisplayed(action)
    assert.ok(all(find(item => hasClass(item, 'selected-song'))).includes(action), 'named current action belongs to the current-song row')
  } else {
    assert.equal(find(item => hasClass(item, 'stage-arrangement')), undefined, 'missing script identity has no guessed arrangement')
    assert.equal(find(item => hasClass(item, 'current-action-slot-probe')), undefined, 'missing selected identity cannot expose a guessed current-song action')
  }
  const slot = find(item => hasClass(item, 'audio-slot-probe'))
  assertDisplayed(slot)
  assert.ok(all(current).includes(slot), 'existing audio/mix slot remains in the current-song area')
  assertCurrentSongBadge()
}

assert.equal(rows().length, library.length, 'one row per actual songCode, not one per script')
assertPermanentSections()
assert.ok(text(root).includes('DRIVE A LIVE'))
assert.ok(text(root).includes('3 人 · 槽位 2 / 3 / 4'))
assert.equal(text(find(item => hasClass(item, 'song-library-title'))), '切换曲目')
assert.equal(categorySelect().options.length, 4, 'actual source categories and counts populate the native category control')
assert.equal(categorySelect().value, 'all')
const beforeCurrent = emits.length
rows().find(item => item.props['data-song-code'] === 'drvalv').props.onClick()
await flush()
assert.equal(emits.length, beforeCurrent, 'choosing current song preserves its exact current Jupiter version')
assertPermanentSections()
assert.equal(rows().length, library.length, 'choosing a song keeps its library rows mounted')

await query('jupiter')
assertPermanentSections()
assert.equal(rows().length, libraryHelpers.filterStageSongLibrary(library, { query: 'jupiter' }).length)
await query('no-such-song-result')
assert.equal(rows().length, 0)
assert.ok(text(root).includes('没有找到符合条件的曲目。'))
assertPermanentSections()
await query('')
await selectCategory('unit')
assert.equal(rows().length, libraryHelpers.filterStageSongLibrary(library, { category: 'unit' }).length,
  'native category select filters the same actual song groups')
assert.equal(buttons().find(item => !hasClass(item, 'song-row') && text(item).startsWith('组合')).props['aria-pressed'], true,
  'native select and desktop category buttons share one category state')
assertPermanentSections()
await selectCategory('all')
buttons().find(item => !hasClass(item, 'song-row') && text(item).startsWith('组合')).props.onClick()
await flush()
assert.equal(rows().length, libraryHelpers.filterStageSongLibrary(library, { category: 'unit' }).length,
  'confirmed category filter changes actual group rows')
assert.equal(categorySelect().value, 'unit', 'desktop category selection also updates the native select')
assertPermanentSections()
buttons().find(item => !hasClass(item, 'song-row') && text(item).startsWith('全部')).props.onClick()
await flush()
rows().find(item => item.props['data-song-code'] === 'knwonl').props.onClick()
await flush()
assert.equal(emits.at(-1), 'knwonl_live_effect')
assert.ok(text(root).includes('K.now O.nly'))
const knwonlSummary = all(find(item => hasClass(item, 'selected-song'))).find(item => item.type === 'small')
assert.equal(text(knwonlSummary), 'THE 虎牙道 · 1 种编排', 'selected actual Unit song visibly identifies its confirmed source unit')
assertDisplayed(knwonlSummary)
assertPermanentSections()
assert.equal(versionSelect(), undefined, 'single real arrangement is presented without a needless version selector')
assert.ok(categorySelect(), 'single arrangement does not remove category filtering')

await query('DRIVE A LIVE')
rows().find(item => item.props['data-song-code'] === 'drvalv').props.onClick()
await flush()
assert.equal(emits.at(-1), 'drvalv_live_effect')
await selectVersion('drvalv_live_effect_03alt')
assert.equal(emits.at(-1), 'drvalv_live_effect_03alt')
assert.ok(text(root).includes('2 人 · 槽位 2 / 3'), 'Altessimo uses actual 2/3 positions, not a guessed 2/4 pair')
const beforeInvalid = emits.length
await selectVersion('made-up-stage')
assert.equal(emits.length, beforeInvalid, 'foreign script IDs cannot be emitted')

state.disabled = true
await flush()
assert.equal(search().props.disabled, true)
assert.equal(categorySelect().props.disabled, true)
assert.equal(rows().every(item => item.props.disabled), true)
await selectVersion('drvalv_live_effect_01jup')
assert.equal(emits.length, beforeInvalid, 'disabled editing blocks variant mutation')
rows().find(item => item.props['data-song-code'] === 'drv999').props.onClick()
await flush()
assert.equal(emits.length, beforeInvalid, 'disabled editing blocks song mutation')
assertPermanentSections()
state.disabled = false
state.selectedSongId = 'mtples_live_effect'
await flush()
assert.ok(text(root).includes('Multiple Entertainment Show!'), 'full long title remains in rendered text')
assertPermanentSections()
state.selectedSongId = 'not-an-authored-stage-id'
await flush()
assertPermanentSections(false)
assert.equal(find(item => hasClass(item, 'selected-song')), undefined)
assert.equal(versionSelect(), undefined)
assert.ok(text(root).includes('选择一首歌曲开始'))
assert.equal(emits.length, beforeInvalid, 'missing selection never auto-emits a guessed script')
state.selectedSongId = 'drvalv'
await flush()
assertPermanentSections(false)
assert.equal(rows().some(row => row.props['aria-pressed']), false, 'a songCode without an exact selected script cannot mark a current row')
await query('')
assert.equal(rows().length, library.length)
rows().find(item => item.props['data-song-code'] === 'knwonl').props.onClick()
await flush()
assert.equal(emits.at(-1), 'knwonl_live_effect', 'explicit song choice recovers from a missing selected identity')
assertPermanentSections()
app.unmount()

const desktopRoot = node('root')
const desktop = renderer.createApp({ render: () => Vue.h(Picker, { songs: rawSongs, selectedSongId: 'knwonl_live_effect' }) })
desktop.mount(desktopRoot)
await flush()
assert.equal(all(desktopRoot).some(item => item.type === 'details' || item.type === 'summary'), false)
assertDisplayed(all(desktopRoot).find(item => hasClass(item, 'stage-arrangement')))
assertDisplayed(all(desktopRoot).find(item => hasClass(item, 'song-library')))
assert.equal(all(desktopRoot).filter(item => hasClass(item, 'song-row')).length, library.length,
  'missing metadata does not hide authored songs or require opening a library')
desktop.unmount()
console.log(`PASS: ChibiSongPicker actual ${rawSongs.length} scripts / ${library.length} song groups; permanent current arrangement and library, named inline current actions and legacy slot preservation, exact selected-song badge with missing-identity guards, real Unit summary, shared native/desktop category selection, search/category filters, current-version preservation, exact two-level selection, disabled/foreign-ID/missing-identity guards, full long title. Memory renderer validates SFC behavior, not viewport scroll or real-device touch.`)
