import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
import { buildSongPresentation } from '../src/presentation/SongPresentation.js'
import {
  buildArchiveViewContext,
  captureArchiveViewState,
  readArchiveViewRestoration,
  restoreArchiveViewState,
} from '../src/core/archiveViewRestoration.js'

// Run the real detail and identity-card templates, including disclosure mounting.
// This proves language, identity and mount-before-restore behavior in a memory host.
// Native disclosure events, browser focus visibility and layout remain separate.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const json = path => JSON.parse(read(path))
const catalog = json('public/data/song_catalog.json')
const dictionary = json('public/data/masterdata/idol_unit_dictionary.json')
const manifest = json('public/data/archive_manifest.json')
const playback = json('public/data/song_playback_audio.json')
const experiments = json('public/data/song_experimental_audio.json')
const translations = json('public/translations/zh-CN/entities/idols.json')
const node = (type, text = '') => {
  const item = { type, text, props: {}, children: [], parent: null, scrollTop: 0, clientHeight: 400 }
  item.dataset = { get archiveFocusId() { return item.props['data-archive-focus-id'] } }
  item.closest = selector => {
    assert.equal(selector, '[data-archive-focus-id]')
    let cursor = item
    while (cursor && !cursor.props['data-archive-focus-id']) cursor = cursor.parent
    return cursor
  }
  item.focus = options => {
    let cursor = item, root = item
    while (cursor.parent) {
      cursor = cursor.parent
      if (cursor.type === 'details') assert.equal(Boolean(cursor.props.open), true,
        'the restore target cannot receive focus inside a closed disclosure')
      root = cursor
    }
    assert.equal(root.type, 'root', 'the restored target is still mounted')
    root.activeElement = item
    root.focusCalls.push({ focusId: item.dataset.archiveFocusId, preventScroll: options?.preventScroll })
  }
  item.getBoundingClientRect = () => ({ height: item.clientHeight })
  Object.defineProperty(item, 'scrollHeight', { configurable: true,
    get: () => 800 + referenceCards(item).length * 44 })
  return item
}
const remove = item => {
  if (item.parent) item.parent.children.splice(item.parent.children.indexOf(item), 1)
  item.parent = null
}
const all = root => [root, ...root.children.flatMap(all)]
const text = root => root.text + root.children.map(text).join('')
const hasClass = (item, name) => String(item.props.class || '').split(/\s+/).includes(name)
const renderer = Vue.createRenderer({
  createElement: type => node(type),
  createText: value => node('#text', value), createComment: value => node('#comment', value),
  setText: (item, value) => { item.text = value },
  setElementText: (item, value) => { item.text = value; item.children = [] },
  patchProp: (item, key, previous, value) => { item.props[key] = value },
  insert(item, parent, anchor = null) {
    remove(item)
    const position = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(position < 0 ? parent.children.length : position, 0, item)
    item.parent = parent
  },
  remove, parentNode: item => item.parent,
  nextSibling: item => item.parent?.children[item.parent.children.indexOf(item) + 1] || null,
})
const context = vm.createContext({ console })
const emptyComponent = { render: () => null }
async function compileComponent(path, imports) {
  const { descriptor } = parse(read(path))
  const source = compileScript(descriptor, { id: path, inlineTemplate: true }).content
  const module = new vm.SourceTextModule(source, { context })
  await module.link(specifier => {
    assert.ok(Object.hasOwn(imports, specifier), `Unexpected production dependency: ${specifier}`)
    const exports = imports[specifier]
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
    }, { context })
  })
  await module.evaluate()
  return module.namespace.default
}
const IdolReference = await compileComponent('src/components/archive/ArchiveIdolReference.vue', {
  vue: Vue,
  '@lucide/vue': { ChevronRight: emptyComponent },
  './ArchiveIdolAvatar.vue': { default: emptyComponent },
})
const SongDetail = await compileComponent('src/components/archive/ArchiveSongDetail.vue', {
  vue: Vue,
  '@lucide/vue': { ChevronRight: emptyComponent, ExternalLink: emptyComponent },
  './ArchiveTechnicalDetails.vue': { default: emptyComponent },
  './ArchiveIdolReference.vue': { default: IdolReference },
  './ArchiveSongExperimentalPlayer.vue': { default: emptyComponent },
  './ArchiveSongSinglePlayer.vue': { default: emptyComponent },
})
const flush = async () => { await Vue.nextTick(); await Vue.nextTick() }
const nameJa = (code, fallback) => fallback
const nameZh = (code, fallback) => translations.entries[code]?.name || fallback
const referenceCards = root => all(root).filter(item => hasClass(item, 'archive-idol-reference'))
const cardLabel = card => text(all(card).find(item => item.type === 'strong'))
class MemoryStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, String(value)) }
}
const audioArchive = root => all(root).find(item => item.type === 'details' &&
  item.children.some(child => child.type === 'summary' && text(child) === '声部与音频归档'))
const keiCard = root => referenceCards(root).find(card => cardLabel(card) === '都筑圭')
function fixture(code, { transform = song => song, keyed = true, presentation = {} } = {}) {
  const song = transform(buildSongPresentation(catalog.songs[code], dictionary, { manifest, ...presentation }))
  const original = JSON.stringify(song)
  const root = node('root'), opened = [], units = [], ready = [], component = Vue.ref(null)
  root.focusCalls = []
  root.activeElement = null
  const state = Vue.shallowReactive({ song, idolName: nameZh })
  const app = renderer.createApp({ render: () => Vue.h(SongDetail, {
    ...state, key: keyed ? state.song.id : undefined, ref: component, idolSearch: () => '',
    onOpenIdol: code => opened.push(code), onOpenUnit: code => units.push(code),
    onReady: value => ready.push(value.songId),
  }) })
  app.config.warnHandler = message => assert.fail(message)
  app.mount(root)
  const document = {
    get activeElement() { return root.activeElement },
    querySelector(selector) {
      assert.equal(selector, '[data-archive-scroll-container]')
      return all(root).find(item => Object.hasOwn(item.props, 'data-archive-scroll-container')) || null
    },
    querySelectorAll(selector) {
      assert.equal(selector, '[data-archive-focus-id]')
      return all(root).filter(item => item.props['data-archive-focus-id'])
    },
  }
  return { root, state, opened, units, ready, component, song, original, app, document,
    prepare: (focusId, songId = state.song.id, isCurrent = () => true) =>
      component.value.prepareRestoreFocus({ focusId, songId, isCurrent }),
  }
}
async function openAudioArchive(t) {
  const section = audioArchive(t.root)
  assert.ok(section)
  section.props.onToggle({ target: { open: true } })
  await flush()
  return section
}

// Inspect the actual rendered hero rather than source selectors or CSS. Real
// catalog entries cover ready and unavailable playback, all four attributes,
// a special version, and the implementation-history date. This host does not
// decode audio: presence of a playback projection is distinct from media QA.
function hero(t) {
  const header = all(t.root).find(item => item.type === 'header')
  assert.ok(header)
  assert.equal(all(header).filter(item => item.type === 'dl').length, 0,
    'the redundant availability/form/date parameter grid is removed')
  assert.equal(all(header).filter(item => item.type === 'h2').map(text).join(''), t.song.title)
  assert.equal(text(header).includes(t.song.playbackLabel.replace(' · 实验混音', '')), false,
    'playback availability is not repeated in the song hero')
  const forms = all(header).filter(item => hasClass(item, 'badge') && text(item) === t.song.formLabel)
  assert.equal(forms.length, 1, 'the hero renders the audio form once')
  assert.equal(JSON.stringify(t.song), t.original, 'hero adaptation preserves projected source evidence')
  return header
}
for (const [code, attribute] of [['drvalv', 'ALL'], ['flslgt', 'Physical'], ['anwhre', 'Intelli'], ['cfprde', 'Mental']]) {
  const t = fixture(code, { presentation: { playbackTrack: playback.songs[code] } }); await flush()
  const header = hero(t)
  const badge = all(header).find(item => Object.hasOwn(item.props, 'data-song-attribute'))
  assert.ok(badge)
  assert.equal(text(badge), attribute, 'attributes use player-facing names without a repeated prefix')
  assert.equal(badge.props['data-song-attribute'], t.song.attributeLabel,
    'the source attribute remains distinct from its local display alias')
  assert.equal(text(all(header).find(item => hasClass(item, 'song-detail-date'))),
    `${catalog.songs[code].gameplay.history.firstImplementedOn} 实装`)
  assert.equal(all(t.root).filter(item => hasClass(item, 'song-playback-unavailable')).length, 0,
    'a real full-mix playback projection does not show an unavailable status')
  t.app.unmount()
}
{
  const t = fixture('drvalv', { presentation: { audioExperiment: experiments.songs.drvalv } }); await flush()
  hero(t)
  assert.equal(all(t.root).filter(item => hasClass(item, 'song-playback-unavailable')).length, 0,
    'a real experimental playback projection does not show an unavailable status')
  t.app.unmount()
}
{
  const t = fixture('drvalv'); await flush()
  hero(t)
  const unavailable = all(t.root).filter(item => hasClass(item, 'song-playback-unavailable'))
  assert.equal(unavailable.length, 1)
  assert.equal(unavailable[0].props.role, 'status')
  assert.equal(text(unavailable[0]), '暂未提供试听',
    'collected audio identities do not imply an available playback projection')
  assert.equal(t.song.fullMixCollected, true)
  t.app.unmount()
}
{
  const t = fixture('drv999', { presentation: { playbackTrack: playback.songs.drv999 } }); await flush()
  const header = hero(t)
  assert.equal(all(header).filter(item => hasClass(item, 'badge') && text(item) === '特殊版本').length, 1)
  assert.equal(text(all(header).find(item => hasClass(item, 'song-detail-date'))), '2022-04-01 实装',
    'the special marker does not replace a recorded implementation date')
  const parent = all(header).find(item => item.type === 'button')
  assert.equal(parent.dataset.archiveFocusId, `song-parent:${t.song.parentId}`)
  t.app.unmount()
}
{
  // All current catalog entries have resolved attributes and gameplay history.
  // Labeled omissions derived from a real projection exercise fallback paths;
  // they are not represented as new corpus coverage or historical facts.
  const t = fixture('drvalv', { transform: song => ({ ...song, attributeLabel: '待确认',
    gameplay: null, openDate: '2021年10月6日' }) }); await flush()
  let header = hero(t)
  let attribute = all(header).find(item => Object.hasOwn(item.props, 'data-song-attribute'))
  assert.equal(text(attribute), '待确认')
  assert.equal(attribute.props['data-song-attribute'], '待确认')
  assert.equal(text(all(header).find(item => hasClass(item, 'song-detail-date'))), '2021年10月6日 实装')
  for (const [openDate, expected] of [['初始收录', '初始收录'], ['未收录', '实装日期未收录'],
    ['特殊版本', '实装日期未收录'], ['', '实装日期未收录']]) {
    t.state.song = { ...t.state.song, openDate }; await flush()
    header = all(t.root).find(item => item.type === 'header')
    assert.equal(text(all(header).find(item => hasClass(item, 'song-detail-date'))), expected)
  }
  t.app.unmount()
}

{
  const t = fixture('flslgt'); await flush()
  assert.equal(all(t.root).some(item => hasClass(item, 'is-sticky-fit')), false,
    'without ResizeObserver, the real template safely keeps its default flow')
  const main = all(t.root).find(item => hasClass(item, 'performer-list'))
  assert.equal(referenceCards(main).length, 4, 'the fixed lineup stays distinct from the audio archive')
  assert.equal(Boolean(audioArchive(t.root).props.open), false)
  assert.equal(referenceCards(audioArchive(t.root)).length, 0, 'initial entry keeps the 49 audio identities unmounted')
  assert.ok(t.ready.includes('flslgt'), 'ready identifies the mounted song without reading window.location')
  const audio = await openAudioArchive(t)
  assert.equal(referenceCards(audio).length, 49, 'all collected voice identities mount after opening the archive')
  const mainKei = keiCard(main), audioKei = keiCard(audio)
  assert.notEqual(mainKei.dataset.archiveFocusId, audioKei.dataset.archiveFocusId,
    'the same idol has distinct performer and audio-archive navigation targets')
  const ids = t.document.querySelectorAll('[data-archive-focus-id]').map(item => item.dataset.archiveFocusId)
  assert.equal(new Set(ids).size, ids.length, 'all simultaneously mounted song navigation targets are unique')
  assert.equal(cardLabel(mainKei), '都筑圭')
  assert.equal(cardLabel(audioKei), '都筑圭', 'audio names use the same locale callback as the performer names')
  assert.equal(audioKei.props['aria-label'], '查看都筑圭的偶像资料')
  audioKei.props.onClick()
  assert.deepEqual(t.opened, ['007kei'], 'a translated label still opens the canonical idol code')
  t.state.idolName = nameJa; await flush()
  assert.equal(cardLabel(mainKei), '都築 圭')
  assert.equal(cardLabel(audioKei), '都築 圭', 'already-open audio rows react to language changes')
  t.state.idolName = () => ''; await flush()
  assert.equal(cardLabel(mainKei), '都築 圭')
  assert.equal(cardLabel(audioKei), '都築 圭', 'missing translations retain the source name')
  assert.equal(JSON.stringify(t.song), t.original, 'language adaptation does not mutate the presentation or reference evidence')
  t.app.unmount()
}
{
  const t = fixture('drvalv'); await flush()
  assert.equal(t.song.performers.length, 0, 'configurable formation is not relabeled as 49 fixed performers')
  const audio = await openAudioArchive(t)
  const cards = referenceCards(audio)
  assert.equal(cards.length, 49)
  const expectedNames = t.song.audioGroups.filter(group => group.kind === 'idol')
    .flatMap(group => group.entries.map(entry => nameZh(entry.id, entry.reference.displayName)))
  assert.deepEqual(cards.map(cardLabel).sort(), expectedNames.sort())
  assert.ok(cards.some(card => cardLabel(card) === '阿斯兰·别西卜II世'))
  const unit = all(audio).find(item => item.type === 'button' &&
    item.dataset.archiveFocusId?.includes(':unit:') && !item.props.disabled)
  assert.ok(unit, 'the real archive also exposes actionable collected unit targets')
  unit.props.onClick()
  assert.deepEqual(t.units, [t.song.audioGroups.find(group => group.kind === 'unit').entries
    .find(entry => unit.dataset.archiveFocusId.endsWith(`:${entry.id}`)).id])
  const ids = t.document.querySelectorAll('[data-archive-focus-id]').map(item => item.dataset.archiveFocusId)
  assert.equal(new Set(ids).size, ids.length, 'real unit and individual audio groups have unique targets')
  const unitFocusId = unit.dataset.archiveFocusId
  assert.equal(JSON.stringify(t.song), t.original)
  t.app.unmount()
  const returned = fixture('drvalv'); await flush()
  assert.equal(await returned.prepare(unitFocusId), true, 'unit archive targets receive the same lazy preparation as idol targets')
  assert.ok(returned.document.querySelectorAll('[data-archive-focus-id]')
    .some(item => item.dataset.archiveFocusId === unitFocusId))
  returned.app.unmount()
}
{
  const storage = new MemoryStorage()
  const context = buildArchiveViewContext('http://test/?view=song_detail&song=flslgt', { sidemArchiveEntryId: 'song-before-idol' })
  const before = fixture('flslgt'); await flush()
  const audio = await openAudioArchive(before), target = keiCard(audio)
  const audioFocusId = target.dataset.archiveFocusId
  target.focus({ preventScroll: true })
  before.document.querySelector('[data-archive-scroll-container]').scrollTop = 1810
  assert.equal(captureArchiveViewState(context, { root: before.document, storage }), true)
  before.app.unmount()

  const returned = fixture('flslgt'); await flush()
  assert.equal(referenceCards(audioArchive(returned.root)).length, 0)
  const saved = readArchiveViewRestoration(context, storage)
  assert.equal(saved.focusId, audioFocusId)
  assert.equal(await returned.prepare(saved.focusId), true)
  assert.equal(Boolean(audioArchive(returned.root).props.open), true, 'preparation opens the native disclosure model')
  assert.equal(referenceCards(audioArchive(returned.root)).length, 49, 'preparation resolves only after the lazy target has mounted')
  assert.equal(returned.root.focusCalls.length, 0, 'the component prepares content and delegates focus to the shared restorer')
  assert.equal(await restoreArchiveViewState(context, { root: returned.document, storage }), true)
  assert.equal(returned.root.activeElement.dataset.archiveFocusId, audioFocusId)
  assert.equal(returned.document.querySelector('[data-archive-scroll-container]').scrollTop, 1810)
  assert.deepEqual(returned.root.focusCalls, [{ focusId: audioFocusId, preventScroll: true }])
  returned.app.unmount()

  const mainOnly = fixture('flslgt'); await flush()
  const mainFocusId = keiCard(all(mainOnly.root).find(item => hasClass(item, 'performer-list'))).dataset.archiveFocusId
  assert.equal(await mainOnly.prepare(mainFocusId), true)
  assert.equal(Boolean(audioArchive(mainOnly.root).props.open), false, 'a main performer target does not open the audio archive')
  assert.equal(referenceCards(audioArchive(mainOnly.root)).length, 0)
  assert.equal(await mainOnly.prepare(audioFocusId, 'drvalv'), false, 'an explicit wrong song owner is rejected')
  assert.equal(await mainOnly.prepare(`${audioFocusId}:expired`), false, 'a no-longer-matching target is rejected')
  assert.equal(await mainOnly.prepare(audioFocusId, 'flslgt', () => false), false, 'a cancelled preparation cannot create lazy audio rows')
  assert.equal(referenceCards(audioArchive(mainOnly.root)).length, 0)
  mainOnly.app.unmount()

  const otherSong = fixture('drvalv'); await flush()
  assert.equal(await otherSong.prepare(audioFocusId), false, 'a saved target from another song never opens this archive')
  assert.equal(referenceCards(audioArchive(otherSong.root)).length, 0)
  otherSong.app.unmount()
}
{
  // The current corpus has no song with multiple idol groups. Use a labeled
  // extension of real references to cover future vocal/oneshot group collisions.
  const t = fixture('drvalv', { transform: song => ({ ...song, audioGroups: [...song.audioGroups,
    { ...song.audioGroups.find(group => group.kind === 'idol'), title: '演出语音 / 单发: 特殊' },
  ] }) }); await flush()
  const audio = await openAudioArchive(t)
  const repeatedKei = referenceCards(audio).filter(card => cardLabel(card) === '都筑圭')
  assert.equal(repeatedKei.length, 2)
  assert.notEqual(repeatedKei[0].dataset.archiveFocusId, repeatedKei[1].dataset.archiveFocusId,
    'the same idol in two archive groups has distinct navigation targets')
  assert.ok(repeatedKei[1].dataset.archiveFocusId.includes(encodeURIComponent('演出语音 / 单发: 特殊')),
    'group punctuation is encoded without colliding with ID separators')
  const ids = t.document.querySelectorAll('[data-archive-focus-id]').map(item => item.dataset.archiveFocusId)
  assert.equal(new Set(ids).size, ids.length)
  t.app.unmount()
}
{
  const t = fixture('flslgt', { keyed: false }); await flush()
  const audioFocusId = t.song.audioGroups.flatMap(group => group.entries
    .filter(entry => entry.id === '007kei')
    .map(entry => `song-audio:${t.song.id}:${encodeURIComponent(group.title)}:${group.kind}:${entry.id}`))[0]
  let current = true
  const preparing = t.prepare(audioFocusId, 'flslgt', () => current)
  current = false
  assert.equal(await preparing, false, 'ownership cancellation during nextTick invalidates preparation')
  assert.equal(t.root.focusCalls.length, 0)
  t.state.song = buildSongPresentation(catalog.songs.drvalv, dictionary, { manifest })
  await flush()
  assert.equal(Boolean(audioArchive(t.root).props.open), false, 'changing a song resets a previously opened archive even without keyed remount')
  assert.equal(referenceCards(audioArchive(t.root)).length, 0)
  assert.equal(t.ready.at(-1), 'drvalv', 'the ready payload identifies the replacement song')
  assert.equal(await t.prepare(audioFocusId), false, 'a replacement song rejects the old song target')
  const unit = t.state.song.audioGroups.find(group => group.kind === 'unit').entries.find(entry => entry.actionable)
  const group = t.state.song.audioGroups.find(group => group.kind === 'unit')
  const prepare = t.component.value.prepareRestoreFocus
  const unmounting = prepare({ focusId: `song-audio:drvalv:${encodeURIComponent(group.title)}:unit:${unit.id}`, songId: 'drvalv' })
  t.app.unmount()
  assert.equal(await unmounting, false, 'unmounting during preparation cannot authorize shared restoration')
  assert.equal(await prepare({ focusId: audioFocusId, songId: 'flslgt' }), false)
}
{
  // Reproduce the measured failure dimensions in the real mounted SFC. The
  // style values are lifecycle fixtures, not assertions about emitted CSS.
  const observers = []
  let styleReads = 0
  class FitObserver {
    targets = new Set()
    disconnected = false
    constructor(callback) { this.callback = callback; observers.push(this) }
    observe(target) { this.targets.add(target) }
    disconnect() { this.disconnected = true; this.targets.clear() }
  }
  context.ResizeObserver = FitObserver
  context.getComputedStyle = item => {
    styleReads++
    return hasClass(item, 'song-detail') ? { paddingBottom: '24px' } : { top: '12px' }
  }
  const t = fixture('drvalv'); await flush()
  try {
    assert.equal(observers.length, 1, 'one observer owns this mounted detail')
    const observer = observers[0]
    const scroll = all(t.root).find(item => hasClass(item, 'song-detail'))
    const column = all(t.root).find(item => hasClass(item, 'song-listen-column'))
    assert.equal(observer.targets.size, 2)
    const observedNodes = [...observer.targets].map(Vue.toRaw)
    assert.ok(observedNodes.includes(scroll) && observedNodes.includes(column),
      'viewport and listening-content sizes are both observed')
    scroll.clientHeight = 824
    column.clientHeight = 1595
    Object.defineProperty(scroll, 'scrollHeight', { configurable: true, value: 40441 })
    observer.callback(); await flush()
    assert.equal(hasClass(column, 'is-sticky-fit'), false,
      'tall full lyrics stay in flow even with 40441px of left archive content')
    column.clientHeight = 788
    observer.callback(); await flush()
    assert.equal(hasClass(column, 'is-sticky-fit'), true,
      'a column that exactly fits the viewport including top and bottom space can stick')
    column.clientHeight = 789
    observer.callback(); await flush()
    assert.equal(hasClass(column, 'is-sticky-fit'), false,
      'content growth beyond available space disables sticky')
    column.clientHeight = 700
    observer.callback(); await flush()
    assert.equal(hasClass(column, 'is-sticky-fit'), true)
    scroll.clientHeight = 700
    observer.callback(); await flush()
    assert.equal(hasClass(column, 'is-sticky-fit'), false,
      'a shorter viewport invalidates a previously fitting column')
    scroll.clientHeight = 824
    observer.callback(); await flush()
    assert.equal(hasClass(column, 'is-sticky-fit'), true,
      'viewport growth restores sticky eligibility')
    const readsBeforeUnmount = styleReads
    t.app.unmount()
    assert.equal(observer.disconnected, true)
    assert.equal(observer.targets.size, 0)
    observer.callback(); await flush()
    assert.equal(styleReads, readsBeforeUnmount,
      'late delivery after unmount never reads released DOM refs')
  } finally {
    if (!observers[0]?.disconnected) t.app.unmount()
    delete context.ResizeObserver
    delete context.getComputedStyle
  }
}
console.log('Song detail: actual SFC compact hero metadata/form uniqueness, four source attributes, real full-mix/experiment/unavailable projections, source dates and special-version parent passed. Labeled unknown-attribute/date omissions passed. Existing language/identity parity, 4-versus-49 scope, immutable evidence, lazy initial mount, unique performer/idol/unit audio targets, native-open and mount-before-shared-restore, preserved scroll, main-list isolation, wrong/stale/cancelled targets and song-change/unmount guards passed. ResizeObserver lifecycle, viewport-versus-content height, fit/growth/resize and unmount guards passed in the real template; the measured tall-lyrics/40441px archive dimensions are labeled host fixtures. Labeled synthetic multi-group IDs also passed. Memory-renderer evidence; decoded audio, native events, Browser/layout/focus visibility and App routing acceptance are separate.')
