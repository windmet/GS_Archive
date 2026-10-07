import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as Vue from 'vue'
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc'
import { authoredSongLyrics, activeSongLyric, sharesSongAudio } from '../src/utils/songLyrics.js'
import { createMediaElementClock } from '../src/utils/mediaElementClock.js'

// Exercise the production SFC and clock in a memory host. Browser geometry,
// native disclosure/focus and real media playback remain separate acceptance.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const manifest = JSON.parse(read('public/data/song_timelines/manifest.json'))
const base = manifest.songs.drvalv.find(entry => !entry.variant)
const actualTimeline = JSON.parse(read(`public${base.url}`))
const actualLines = authoredSongLyrics(actualTimeline, 'drvalv')
const all = root => [root, ...root.children.flatMap(all)]
const text = root => root.text + root.children.map(text).join('')
const classIs = (item, name) => String(item.props.class || '').split(/\s+/).includes(name)
let scrollCalls = 0
const noScroll = () => { scrollCalls++; throw new Error('Lyrics must not scroll the page or an inner list') }
const node = (type, value = '') => {
  const item = { type, text: value, props: {}, children: [], parent: null, clientHeight: 44, offsetTop: 0 }
  Object.defineProperty(item, 'scrollTop', { get: () => 237, set: noScroll })
  item.scrollIntoView = noScroll
  item.focus = () => { throw new Error('Lyrics must not move focus automatically') }
  item.querySelector = selector => {
    assert.equal(selector, '[aria-current="true"]')
    return all(item).find(child => child.props['aria-current'] === 'true')
  }
  return item
}
const remove = item => {
  if (item.parent) item.parent.children.splice(item.parent.children.indexOf(item), 1)
  item.parent = null
}
const renderer = Vue.createRenderer({
  createElement: type => node(type), createText: value => node('#text', value), createComment: value => node('#comment', value),
  setText: (item, value) => { item.text = value },
  setElementText: (item, value) => { item.text = value; item.children = [] },
  patchProp: (item, key, previous, value) => { item.props[key] = value },
  insert(item, parent, anchor = null) {
    remove(item)
    const at = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(at < 0 ? parent.children.length : at, 0, item)
    item.parent = parent
  },
  remove, parentNode: item => item.parent,
  nextSibling: item => item.parent?.children[item.parent.children.indexOf(item) + 1] || null,
})
const fetchRequests = [], pending = new Map()
const fetchTimeline = songCode => {
  fetchRequests.push(songCode)
  return new Promise((resolve, reject) => pending.set(songCode, { resolve, reject }))
}
const context = vm.createContext({ console, window: { scrollTo: noScroll, scrollBy: noScroll } })
const filename = 'src/components/archive/ArchiveSongLyrics.vue'
const { descriptor, errors } = parse(read(filename), { filename })
assert.deepEqual(errors, [])
for (const style of descriptor.styles) {
  assert.deepEqual(compileStyle({ source: style.content, filename, id: 'lyrics-regression', scoped: style.scoped }).errors, [])
}
const source = compileScript(descriptor, { id: 'lyrics-regression', inlineTemplate: true }).content
const module = new vm.SourceTextModule(source, { context })
const imports = {
  vue: Vue,
  '../../utils/songPerformanceData.js': { fetchSongBaseTimeline: fetchTimeline },
  '../../utils/songLyrics.js': { authoredSongLyrics, activeSongLyric, sharesSongAudio },
}
// The real error note supplies the alert role and wraps the message and retry button.
const noteFile = 'src/components/archive/ArchiveErrorNote.vue'
const note = new vm.SourceTextModule(compileScript(parse(read(noteFile), { filename: noteFile }).descriptor,
  { id: 'lyrics-error-note', inlineTemplate: true }).content, { context })
const noteImports = { vue: Vue, '@lucide/vue': { CircleAlert: { render: () => null } } }
const synthetic = (table, specifier) => {
  assert.ok(Object.hasOwn(table, specifier), `Unexpected production dependency: ${specifier}`)
  const exports = table[specifier]
  return new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
  }, { context })
}
await note.link(specifier => synthetic(noteImports, specifier))
await module.link(specifier => {
  if (specifier === './ArchiveErrorNote.vue') return note
  assert.ok(Object.hasOwn(imports, specifier), `Unexpected production dependency: ${specifier}`)
  const exports = imports[specifier]
  return new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
  }, { context })
})
await module.evaluate()
const Lyrics = module.namespace.default
const flush = async () => { for (let index = 0; index < 4; index++) await Vue.nextTick() }
function mount(initial, onSeek = () => {}) {
  const state = Vue.reactive(initial), root = node('root'), seeks = []
  const app = renderer.createApp({ render: () => Vue.h(Lyrics, { ...state, onSeek: value => { seeks.push(value); onSeek(value) } }) })
  app.mount(root)
  return { state, root, seeks, app }
}
const disclosure = root => all(root).find(item => item.type === 'details')
const list = root => all(root).find(item => item.type === 'ol')
const rows = root => list(root)?.children.filter(item => item.type === 'li') || []
const rowButtons = root => rows(root).map(row => row.children.find(item => item.type === 'button')).filter(Boolean)
const expand = root => all(root).find(item => item.type === 'button' && classIs(item, 'lyrics-expand'))
const current = root => rowButtons(root).filter(item => item.props['aria-current'] === 'true')
const fire = (item, event, value = {}) => {
  assert.ok(item, `Missing ${event} target`)
  const handlers = item.props[`on${event}`]
  assert.ok(handlers, `Missing ${event} handler`)
  for (const handler of [].concat(handlers)) handler(value)
}
const toggle = async (root, open) => { fire(disclosure(root), 'Toggle', { target: { open } }); await flush() }

class FakeAudio extends EventTarget {
  currentTime = 0; duration = NaN; playbackRate = 1; readyState = 0; paused = true; seeking = false; ended = false; error = null
  fire(name) { this.dispatchEvent(new Event(name)) }
}
let clock
const player = mount({ songCode: 'drvalv', sourceTimeline: actualTimeline, audioUrl: actualTimeline.audioRef.url, ready: false, currentTime: 0 }, value => clock.seek(value))
assert.equal(fetchRequests.length, 0, 'a closed disclosure does not fetch')
assert.equal(list(player.root), undefined, 'lyrics are lazy mounted')
await toggle(player.root, true)
assert.equal(rows(player.root).length, 6)
assert.equal(current(player.root).length, 0)
assert.ok(rowButtons(player.root).every(button => button.props.disabled === true))
fire(rowButtons(player.root)[0], 'Click')
assert.deepEqual(player.seeks, [], 'an invoked disabled handler still respects the ready guard')
clock = createMediaElementClock(snapshot => {
  player.state.currentTime = snapshot.currentTime
  player.state.ready = snapshot.duration > 0 && snapshot.phase !== 'error'
})
const audio = new FakeAudio()
clock.bind(audio)
audio.duration = actualTimeline.durationMs / 1000
audio.readyState = 2
audio.fire('loadedmetadata')
await flush()
const late = actualLines.find(line => line.time >= 90000 && line.end > line.time)
assert.ok(late, 'real DRIVE A LIVE has a late authored interval')
clock.seek((late.time + Math.min(10, late.end - late.time) / 2) / 1000)
await flush()
assert.equal(rows(player.root).length, 6)
assert.deepEqual(current(player.root).map(text), [late.text], 'a late current lyric is present in the compact preview')
const focused = rowButtons(player.root)[2]
fire(focused, 'Focus')
clock.seek(actualLines.at(-1).time / 1000)
await flush()
assert.ok(rowButtons(player.root).includes(focused), 'playback does not unmount the focused lyric')
fire(focused, 'Blur')
await flush()
assert.deepEqual(current(player.root).map(text), [actualLines.at(-1).text])
fire(expand(player.root), 'Click')
await flush()
assert.equal(rows(player.root).length, actualLines.length, 'full lyrics retain every authored event')
assert.equal(expand(player.root).props['aria-expanded'], true)
const staticNodes = [...rowButtons(player.root)]
clock.seek(actualLines[3].time / 1000)
await flush()
assert.deepEqual(rowButtons(player.root), staticNodes, 'full lyrics do not reorder as the clock advances')
fire(rowButtons(player.root)[3], 'Click')
await flush()
assert.equal(player.seeks.at(-1), actualLines[3].time / 1000, 'seek emits authored milliseconds as seconds')
assert.equal(audio.currentTime, actualLines[3].time / 1000, 'the real media clock consumes the lyric seek')
audio.duration = 1
fire(rowButtons(player.root).at(-1), 'Click')
await flush()
assert.equal(audio.currentTime, 1, 'the real clock clamps an authored seek to its current duration')
fire(expand(player.root), 'Click')
await flush()
assert.equal(rows(player.root).length, 6)
player.state.audioUrl = '/different-release.m4a'
await flush()
assert.equal(rowButtons(player.root).length, 0, 'an unrelated audio URL has read-only lyrics')
assert.equal(rows(player.root)[0].children[0].type, 'span')
assert.equal(current(player.root).length, 0)
player.state.stageClock = true
await flush()
assert.equal(rowButtons(player.root).length, 6, 'an explicitly authored stage clock remains supported')
assert.equal(all(player.root).filter(item => item.type === 'input').length, 0, 'the follow checkbox is absent')
assert.ok(!text(player.root).includes('点击歌词跳转'))
await toggle(player.root, false)
assert.equal(list(player.root), undefined)
await toggle(player.root, true)
assert.equal(rows(player.root).length, 6, 'reopening returns to compact preview')
player.app.unmount()
clock.dispose()

const fixture = { songCode: 'bilingual', timeUnit: 'ms', audioRef: { url: '/bilingual.m4a' }, singerEvents: [{ time: 0, performerSlots: [1] }], lyricEvents:
  Array.from({ length: 12 }, (_, index) => ({ time: index * 4000, duration: 1000, text: index === 0 ? '日本語の歌詞\n中文歌词' : `第${index + 1}句` })) }
const bilingual = mount({ songCode: 'bilingual', sourceTimeline: fixture, audioUrl: '/bilingual.m4a', ready: true, currentTime: 0 })
await toggle(bilingual.root, true)
assert.equal(text(rowButtons(bilingual.root)[0]), fixture.lyricEvents[0].text, 'both languages and authored newlines are preserved')
bilingual.state.currentTime = 30
await flush()
assert.equal(current(bilingual.root).length, 0, 'a timeline gap cannot extend aria-current')
assert.ok(rowButtons(bilingual.root).some(button => text(button) === fixture.lyricEvents[7].text), 'gap preview stays near the preceding authored event')
fire(expand(bilingual.root), 'Click')
await flush()
assert.deepEqual(rowButtons(bilingual.root).map(text), fixture.lyricEvents.map(line => line.text))
bilingual.state.ready = false
await flush()
assert.equal(current(bilingual.root).length, 0)
fire(rowButtons(bilingual.root)[0], 'Click')
assert.deepEqual(bilingual.seeks, [])
bilingual.state.sourceTimeline = { ...fixture, songCode: 'wrong-song' }
await flush()
assert.equal(rows(bilingual.root).length, 0, 'a stale source timeline cannot display another song')
bilingual.app.unmount()

const loading = mount({ songCode: 'first', stageClock: true, ready: true })
assert.equal(fetchRequests.length, 0)
await toggle(loading.root, true)
assert.deepEqual(fetchRequests, ['first'])
assert.ok(all(loading.root).some(item => item.props.role === 'status'))
loading.state.songCode = 'second'
await flush()
assert.deepEqual(fetchRequests, ['first', 'second'])
pending.get('first').resolve({ ...fixture, songCode: 'first' })
await flush()
assert.equal(rows(loading.root).length, 0, 'a superseded response cannot replace the current request')
pending.get('second').reject(new Error('network'))
await flush()
assert.ok(all(loading.root).some(item => item.props.role === 'alert'))
fire(all(loading.root).find(item => item.type === 'button' && text(item) === '重试'), 'Click')
await flush()
pending.get('second').resolve({ ...fixture, songCode: 'second' })
await flush()
assert.equal(rows(loading.root).length, 6)
loading.state.songCode = 'third'
await flush()
await toggle(loading.root, false)
pending.get('third').resolve({ ...fixture, songCode: 'third' })
await flush()
assert.equal(list(loading.root), undefined, 'closing cancels visible results from a pending request')
await toggle(loading.root, true)
loading.app.unmount()
pending.get('third').resolve({ ...fixture, songCode: 'third' })
await flush()
assert.equal(loading.root.children.length, 0)
assert.equal(scrollCalls, 0, 'no time update, seek or disclosure action writes scroll state')
console.log(`Song lyric presentation: real ${actualLines.length}-event DRIVE timeline, late preview/gap/full/focus identity, bilingual text, ready/audio/seek guards, real clock clamp, lazy/stale/error/retry/unmount and zero automatic scrolling passed; no Browser geometry or media playback implied`)
