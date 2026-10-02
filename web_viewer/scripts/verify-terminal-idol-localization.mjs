import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { computed, createSSRApp, ref, shallowRef } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { EntityTranslationRepository } from '../src/localization/story/EntityTranslationRepository.js'
import { IDOL_ID_TO_NAME } from '../src/utils/IdolNameMap.js'
import { buildIdolReference } from '../src/presentation/IdolReferencePresentation.js'
import { buildSongPresentation } from '../src/presentation/SongPresentation.js'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const dictionary = JSON.parse(read('public/data/masterdata/idol_unit_dictionary.json'))
const overlay = JSON.parse(read('public/translations/zh-CN/entities/idols.json'))
const sourceNames = Object.fromEntries(Object.entries(dictionary.by_idol_code).map(([id, idol]) => [id, idol.display_name]))
const repository = new EntityTranslationRepository({
  fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify(overlay) }),
})
await repository.loadEntity({ entityType: 'idol', locale: 'zh-CN', sourceNames: IDOL_ID_TO_NAME })

// Exercise the production App callbacks with the real source dictionary and overlay.
const app = read('src/App.vue')
const locale = ref('zh-CN')
const context = vm.createContext({
  bootstrapIdolDictionary: dictionary, IDOL_ID_TO_NAME, uiLocale: locale,
  storyTranslationLocale: ref('zh-CN'), idolEntityTranslationRevision: ref(0),
  entityTranslationRepository: repository,
})
for (const name of ['idolSourceName', 'idolTranslatedName', 'idolDisplayName', 'idolEntitySearchText']) {
  const source = app.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))?.[0]
  assert.ok(source, `Missing App callback: ${name}`)
  vm.runInContext(source, context)
}
const callbacks = { idolName: context.idolDisplayName, idolSearch: context.idolEntitySearchText }
const idols = [
  { id: '029ass', name: sourceNames['029ass'], unitName: 'Café Parade' },
  { id: '007kei', name: sourceNames['007kei'], unitName: 'Altessimo' },
]
const manifest = JSON.parse(read('public/data/archive_manifest.json'))
const card = JSON.parse(read('public/data/masterdata/card_index.json')).cards
  .find(entry => entry.character_id === '001tom' && entry.rarity === 'SSR')
assert.ok(card)
const owner = buildIdolReference(card.character_id, dictionary, manifest, `card:${card.resource_id}`)
context.computed = computed
context.currentCardId = ref(card.resource_id)
context.cardReadModelDetail = shallowRef({ id: card.resource_id, card, ownerReference: owner })
const ownerProjection = app.slice(app.indexOf('const currentCardOwnerReference = computed('),
  app.indexOf('const currentCardAssetStatus = computed('))
assert.ok(ownerProjection)
const displayedOwner = vm.runInContext(`${ownerProjection}\ncurrentCardOwnerReference`, context)
const catalog = JSON.parse(read('public/data/song_catalog.json')).songs
const playback = JSON.parse(read('public/data/song_playback_audio.json')).songs
const experiments = JSON.parse(read('public/data/song_experimental_audio.json')).songs
const song = id => buildSongPresentation(catalog[id], dictionary, {
  manifest, playbackTrack: playback[id], audioExperiment: experiments[id],
})
const drive = song('drvalv'), altessimo = song('tfmvmt')
const soloCodes = Object.keys(drive.playback.experiment.solo_tracks)
assert.equal(soloCodes.length, 49)
const evidenceBefore = JSON.stringify([owner, card, drive, altessimo, experiments])

// Compile and render the actual SFCs. Setting their existing setup refs supplies
// user search/selection state without adding a production demo or browser harness.
const server = await createServer({ configFile: false, plugins: [vue()],
  server: { middlewareMode: true, watch: null, hmr: false },
  optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
function withState(component, values) {
  return { ...component, setup(props, ctx) {
    const state = component.setup(props, ctx)
    if (typeof values === 'function') values(state)
    else for (const [key, value] of Object.entries(values)) state[key].value = value
    return state
  } }
}
const render = (component, props) => renderToString(createSSRApp(component, props))
const elementText = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([^]*?)<\\/${tag}>`, 'g'))]
  .map(match => match[1].trim())
let checks = 0
// The native dialog's immediate focus watcher runs during SSR; there is no DOM
// element or audio playback. Supply only its inert focus origin for these renders.
const previousDocument = globalThis.document
globalThis.document = { activeElement: null }
try {
  const { default: Picker } = await server.ssrLoadModule('/src/components/archive/terminal/ArchiveIdolPickerPanel.vue')
  const { default: Preferred } = await server.ssrLoadModule('/src/components/archive/terminal/ArchivePreferredIdolSlot.vue')
  const { default: Welcome } = await server.ssrLoadModule('/src/components/archive/ArchiveWelcome.vue')
  const { default: Card } = await server.ssrLoadModule('/src/components/archive/ArchiveCardDetail.vue')
  const { default: Song } = await server.ssrLoadModule('/src/components/archive/ArchiveSongDetail.vue')
  const { default: Experimental } = await server.ssrLoadModule('/src/components/archive/ArchiveSongExperimentalPlayer.vue')
  const { default: Lineup } = await server.ssrLoadModule('/src/components/archive/ArchiveSongLineupPlayer.vue')
  for (const currentLocale of ['zh-CN', 'ja-JP']) {
    locale.value = currentLocale
    const displayed = currentLocale === 'zh-CN' ? overlay.entries['029ass'].name : sourceNames['029ass']
    for (const query of ['阿斯兰', 'アスラン', '别西卜II世']) {
      const html = await render(withState(Picker, { query }), { idols, modelValue: '029ass', ...callbacks })
      assert.match(html, /1 位偶像/)
      assert.match(html, /data-idol-code="029ass"/)
      assert.ok(!html.includes('data-idol-code="007kei"'))
      assert.ok(html.includes(`<strong>${displayed}</strong>`))
      assert.ok(html.includes(`已选：${displayed}`))
      checks++
    }
    const slot = await render(Preferred, { idols, value: '029ass', idPrefix: 'regression', ...callbacks })
    assert.ok(slot.includes(`<strong>${displayed}</strong>`))
    const welcome = await render(Welcome, { idols, selectionOnly: true, dataReady: true,
      preferences: { startupIdol: '029ass' }, ...callbacks })
    assert.ok(welcome.includes(`已选：${displayed}`))
    assert.ok(welcome.includes(`<strong>${displayed}</strong>`), 'Welcome passes the name callback to its picker')
    assert.match(welcome, /<button[^>]*aria-pressed="true"[^>]*data-idol-code="029ass"/)
    checks++
    const ownerName = context.idolDisplayName('001tom', owner.displayName)
    assert.equal(displayedOwner.value.displayName, ownerName)
    for (const key of Object.keys(owner).filter(key => key !== 'displayName')) {
      assert.equal(displayedOwner.value[key], owner[key], `owner preserves ${key}`)
    }
    const cardHtml = await render(Card, { card, ownerReference: displayedOwner.value, embedded: true })
    assert.equal(elementText(cardHtml, 'strong').filter(text => text === ownerName).length, 2)
    assert.equal((cardHtml.match(/data-archive-focus-id="idol-reference:001tom"/g) || []).length, 2)
    const performers = await render(Song, { song: altessimo, ...callbacks })
    for (const code of ['007kei', '008rei']) {
      assert.ok(performers.includes(`aria-label="查看${context.idolDisplayName(code)}的偶像资料"`))
      assert.ok(performers.includes(`data-archive-focus-id="idol-reference:${code}"`))
    }
    checks++
    for (const query of ['阿斯兰', 'アスラン', '别西卜II世']) {
      let state
      const solo = await render(withState(Experimental, value => {
        state = value
        value.soloOpen.value = true
        value.soloQuery.value = query
        value.selectedIdolCode.value = '029ass'
        value.mode.value = 'solo'
      }), { song: drive, audioExperiment: drive.playback.experiment, ...callbacks })
      assert.match(solo, /1 位偶像 · 选择后回到播放条/)
      assert.ok(elementText(solo, 'strong').includes(displayed))
      assert.ok(solo.includes(`当前 Solo · ${displayed}`))
      assert.deepEqual(state.filteredSoloEntries.value.map(entry => entry.idol_code), ['029ass'])
      assert.deepEqual(state.soloEntries.value.map(entry => entry.idol_code), soloCodes)
      checks++
    }
    // Render through SongDetail, ExperimentalPlayer and LineupPlayer to catch
    // missing callback forwarding, while retaining the real 49 track identities.
    const lineupSong = withState(Song, value => {
      value.ArchiveSongExperimentalPlayer = withState(Experimental, player => {
        player.mode.value = 'lineup'
        player.ArchiveSongLineupPlayer = withState(Lineup, lineup => {
          lineup.stageLineup.value = ['029ass', '', '', '', '']
          // Supply an active slot for label rendering without decoding or playing audio.
          lineup.session.activePerformerSlots = ref([1])
        })
      })
    })
    const lineup = await render(lineupSong, { song: drive, ...callbacks })
    const selects = [...lineup.matchAll(/<select[^>]*aria-label="舞台位置 [^]*?<\/select>/g)]
    assert.equal(selects.length, 5)
    for (const [select] of selects) {
      assert.deepEqual([...select.matchAll(/<option value="([^"]+)"/g)].map(match => match[1]), soloCodes)
      assert.ok(elementText(select, 'option').includes(displayed))
    }
    assert.ok(lineup.includes(`${displayed}（舞台位 1）`))
    checks++
  }
  const group = await render(withState(Picker, { query: '  café PARADE  ' }), { idols, ...callbacks })
  assert.match(group, /1 位偶像/)
  assert.match(group, /data-idol-code="029ass"/)
  const empty = await render(withState(Picker, { query: '不存在的名字' }), { idols, ...callbacks })
  assert.match(empty, /0 位偶像/)
  assert.match(empty, /没有找到符合条件的偶像/)
  const fallback = await render(Picker, { idols, modelValue: '029ass' })
  assert.ok(fallback.includes(`<strong>${sourceNames['029ass']}</strong>`))
  const unselected = await render(Preferred, { idols, value: 'missing', idPrefix: 'empty', ...callbacks })
  assert.ok(unselected.includes('选择我的偶像'))
  const unselectedWelcome = await render(Welcome, { idols, selectionOnly: true, dataReady: true,
    preferences: { startupIdol: 'missing' }, ...callbacks })
  assert.ok(unselectedWelcome.includes('请选择一位偶像'))
  checks++
  const fallbackSong = await render(Song, { song: altessimo })
  assert.ok(fallbackSong.includes(`aria-label="查看${sourceNames['007kei']}的偶像资料"`))
  let fallbackState
  const fallbackSolo = await render(withState(Experimental, value => {
    fallbackState = value
    value.soloOpen.value = true
  }), { song: drive, audioExperiment: drive.playback.experiment })
  assert.match(fallbackSolo, /49 位偶像 · 选择后回到播放条/)
  assert.ok(elementText(fallbackSolo, 'strong').includes(sourceNames['029ass']))
  assert.deepEqual(fallbackState.filteredSoloEntries.value.map(entry => entry.idol_code), soloCodes)
  const unresolved = buildIdolReference('999xxx', dictionary, manifest, 'card:unknown')
  context.cardReadModelDetail.value = { id: card.resource_id, ownerReference: unresolved }
  assert.equal(displayedOwner.value, unresolved, 'unresolved ownership remains inert and unchanged')
  context.currentCardId.value = 'different-card'
  assert.equal(displayedOwner.value, null, 'a stale owner cannot attach to a new card')
  assert.equal(context.idolDisplayName('999xxx', '原始姓名'), '原始姓名')
  assert.equal(evidenceBefore, JSON.stringify([owner, card, drive, altessimo, experiments]), 'display never mutates source evidence or media tracks')
  checks++
  console.log(`Idol localization: ${checks} SFC render scenarios passed; terminal/card/performer/Solo/lineup display, bilingual search, 49 track IDs, and source/empty/stale fallbacks. No DOM or playback acceptance is implied.`)
} finally {
  if (previousDocument === undefined) delete globalThis.document
  else globalThis.document = previousDocument
  await server.close()
}
