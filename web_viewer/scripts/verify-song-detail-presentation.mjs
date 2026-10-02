import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
import { buildSongPresentation } from '../src/presentation/SongPresentation.js'

// Run the real detail and identity-card templates, including disclosure mounting.
// This proves language and identity behavior; styles and Browser focus are separate.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const json = path => JSON.parse(read(path))
const catalog = json('public/data/song_catalog.json')
const dictionary = json('public/data/masterdata/idol_unit_dictionary.json')
const manifest = json('public/data/archive_manifest.json')
const translations = json('public/translations/zh-CN/entities/idols.json')
const node = (type, text = '') => ({ type, text, props: {}, children: [], parent: null })
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
function fixture(code) {
  const song = buildSongPresentation(catalog.songs[code], dictionary, { manifest })
  const original = JSON.stringify(song)
  const root = node('root'), opened = []
  const state = Vue.shallowReactive({ song, idolName: nameZh })
  const app = renderer.createApp({ render: () => Vue.h(SongDetail, {
    ...state, idolSearch: () => '', onOpenIdol: code => opened.push(code),
  }) })
  app.config.warnHandler = message => assert.fail(message)
  app.mount(root)
  return { root, state, opened, song, original, app }
}
async function openAudioArchive(t) {
  const section = all(t.root).find(item => item.type === 'details' &&
    item.children.some(child => child.type === 'summary' && text(child) === '声部与音频归档'))
  assert.ok(section)
  section.props.onToggle({ target: { open: true } })
  await flush()
  return section
}

{
  const t = fixture('flslgt'); await flush()
  const main = all(t.root).find(item => hasClass(item, 'performer-list'))
  assert.equal(referenceCards(main).length, 4, 'the fixed lineup stays distinct from the audio archive')
  const audio = await openAudioArchive(t)
  assert.equal(referenceCards(audio).length, 49, 'all collected voice identities mount after opening the archive')
  const mainKei = referenceCards(main).find(item => item.props['data-archive-focus-id'] === 'idol-reference:007kei')
  const audioKei = referenceCards(audio).find(item => item.props['data-archive-focus-id'] === 'idol-reference:007kei')
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
  for (const card of cards) {
    const code = card.props['data-archive-focus-id'].slice('idol-reference:'.length)
    assert.equal(cardLabel(card), nameZh(code, dictionary.by_idol_code[code].display_name))
  }
  assert.equal(cardLabel(cards.find(item => item.props['data-archive-focus-id'] === 'idol-reference:029ass')), '阿斯兰·别西卜II世')
  assert.equal(JSON.stringify(t.song), t.original)
  t.app.unmount()
}
console.log('Song detail: actual SFC performer/audio language parity, live locale changes, original-name fallback, canonical identity clicks, 4-versus-49 and configurable-versus-49 scopes, and immutable source evidence passed. Memory-renderer evidence; Browser/layout/focus acceptance is separate.')
