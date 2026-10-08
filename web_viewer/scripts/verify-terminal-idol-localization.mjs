import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { computed, createSSRApp, ref, shallowRef } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { EntityTranslationRepository } from '../src/localization/story/EntityTranslationRepository.js'
import { IDOL_ID_TO_NAME } from '../src/utils/IdolNameMap.js'
import { buildIdolReference } from '../src/presentation/IdolReferencePresentation.js'
import { buildSongPresentation } from '../src/presentation/SongPresentation.js'
import { buildIdolProfile, eventsForIdol, songsForIdol } from '../src/data/idolPage.js'
import { buildUnitCatalog } from '../src/data/unitPage.js'
import { readCheckout } from '../readmodels/lib/checkout_adapter.mjs'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse as parseJavascript } from '@babel/parser'

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
const profile = buildIdolProfile('029ass', dictionary, manifest)
const idolEvents = eventsForIdol(profile.idol_code, manifest)
const idolSongs = songsForIdol(profile.idol_code, { songs: catalog })
const unitEntry = buildUnitCatalog(dictionary, { manifest }).find(entry => entry.unit.unit_code === profile.unit_code)
assert.ok(unitEntry?.members.some(member => member.idol_code === profile.idol_code))
context.currentCharacterId = ref(profile.idol_code)
context.idolReadModelDetail = shallowRef({ id: profile.idol_code, view: {
  profile, stats: {}, events: idolEvents, songs: idolSongs,
} })
const appScript = parseSfc(app).descriptor.scriptSetup.content
const appDeclarations = parseJavascript(appScript, { sourceType: 'module' }).program.body
  .filter(node => node.type === 'VariableDeclaration')
const idolProjectionNames = ['currentIdolDetail', 'currentIdolProfile', 'currentIdolDisplayName', 'currentIdolStats', 'currentIdolEvents', 'currentIdolSongs']
const idolProjectionSource = idolProjectionNames.map(name => {
  const node = appDeclarations.find(declaration => declaration.declarations.some(item => item.id.name === name))
  assert.ok(node, `App declares ${name}`)
  return appScript.slice(node.start, node.end)
}).join('\n')
const [canonicalProfile, displayedProfileName] = vm.runInContext(
  `${idolProjectionSource}\n;[currentIdolProfile, currentIdolDisplayName]`, context)
assert.match(app, /<ArchiveIdolDetail\b[^>]*:idol-name="idolDisplayName"/,
  'App forwards the production display callback to the canonical profile consumer')
assert.match(app, /<ArchiveEventDetail\b[^>]*:display-idol-name="idolDisplayName"/,
  'App forwards the production display callback to the event consumer')
// Use the real offline producer instead of reimplementing event/reward joins.
// These source renders do not imply acceptance of pinned read-model or media bytes.
const { product: eventProduct } = await readCheckout(fileURLToPath(new URL('../', import.meta.url)),
  { dataRevision: 'localization-test', mediaEpoch: 'localization-test' })
const derivedCards = view => view.cards.filter(card =>
  !view.rewards.cards.some(reward => reward.card_resource_id === card.card_resource_id))
const usableEvent = record => record.view.castReferences.some(entry => entry.idol_code === profile.idol_code) &&
  derivedCards(record.view).length > 0 && record.view.episodes.length > 1 &&
  record.view.readingEntries.some(entry => entry.status === 'ready' && entry.source_file === record.view.episodes[0].file)
const preferredEvent = eventProduct.extraDomains.events.records.find(record => record.id === '430013')
const eventRecord = preferredEvent && usableEvent(preferredEvent) ? preferredEvent :
  eventProduct.extraDomains.events.records.find(usableEvent)
assert.ok(eventRecord, 'a real event has Aslan, derived cards and a ready first episode')
const eventView = eventRecord.view
console.log(`Event localization source fixture: ${eventRecord.id} / ${eventView.identity.title}; ${eventView.castReferences.length} cast references, ${derivedCards(eventView).length} derived cards`)
const rewardView = eventProduct.extraDomains.events.records.find(record => record.id === '410012')?.view
const exchangeView = eventProduct.extraDomains.events.records.find(record => record.id === 'event:20001')?.view
assert.ok(rewardView && exchangeView, 'the real point/story/fragment and Wiki exchange consumers are available')
const eventSource = read('src/components/archive/ArchiveEventDetail.vue')
assert.equal((eventSource.match(/@click="emit\('open-card',card\)"/g) || []).length, 2,
  'both reward and exchange actions emit the original card without a display projection')
const sourceEvidence = () => JSON.stringify([owner, card, drive, altessimo, experiments,
  dictionary, overlay, manifest, profile, idolEvents, idolSongs, unitEntry, eventView, rewardView, exchangeView])
const evidenceBefore = sourceEvidence()

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
  .map(match => match[1].replace(/<[^>]*>/g, '').trim())
// Nested decorative markup (for example the idol color swatch) is not text.
// Keep descendant text, so a wrong or duplicated name still fails the assertions.
assert.deepEqual(elementText('<h2>Name<span class="idol-color"></span></h2>', 'h2'), ['Name'])
assert.deepEqual(elementText('<h2>Name<span>Wrong</span></h2>', 'h2'), ['NameWrong'])
const decodeHtml = value => value.replace(/&(?:quot|#39|lt|gt|amp);/g, entity => ({
  '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>', '&amp;': '&',
})[entity])
const technicalEvidence = (html, entity) => {
  // Relation lists also include their own source JSON. Select the actual detail
  // evidence by its canonical entity key rather than counting unrelated blocks.
  const blocks = elementText(html, 'pre').map(block => JSON.parse(decodeHtml(block)))
    .filter(block => block && typeof block === 'object' && Object.hasOwn(block, entity))
  assert.equal(blocks.length, 1, `one production ${entity} detail evidence block`)
  return blocks[0]
}
let checks = 0
let renderedLocale, previousRenderedLocale
// The native dialog's immediate focus watcher runs during SSR; there is no DOM
// element or audio playback. Supply only its inert focus origin for these renders.
const previousDocument = globalThis.document
const previousLocation = globalThis.location
globalThis.document = { activeElement: null }
try {
  const { default: Picker } = await server.ssrLoadModule('/src/components/archive/terminal/ArchiveIdolPickerPanel.vue')
  const { default: Welcome } = await server.ssrLoadModule('/src/components/archive/ArchiveWelcome.vue')
  const { default: Card } = await server.ssrLoadModule('/src/components/archive/ArchiveCardDetail.vue')
  const { default: Song } = await server.ssrLoadModule('/src/components/archive/ArchiveSongDetail.vue')
  const { default: Idol } = await server.ssrLoadModule('/src/components/archive/ArchiveIdolDetail.vue')
  const { default: Unit } = await server.ssrLoadModule('/src/components/archive/ArchiveUnitDetail.vue')
  const { default: Event } = await server.ssrLoadModule('/src/components/archive/ArchiveEventDetail.vue')
  const { default: Media } = await server.ssrLoadModule('/src/components/archive/DomainMediaPreview.vue')
  ;({ uiLocale: renderedLocale } = await server.ssrLoadModule('/src/localization/ui/UiLocaleStore.js'))
  previousRenderedLocale = renderedLocale.value
  const { default: Experimental } = await server.ssrLoadModule('/src/components/archive/ArchiveSongExperimentalPlayer.vue')
  const { default: Lineup } = await server.ssrLoadModule('/src/components/archive/ArchiveSongLineupPlayer.vue')
  const idolProps = { idol: profile, events: idolEvents, songs: idolSongs }
  const unitProps = { unit: unitEntry.unit, members: unitEntry.members,
    identity: dictionary, manifest, cardStats: unitEntry.cardStats, eventRelations: unitEntry.eventRelations }
  globalThis.location = { search: '?maintainer=0' }
  const readerIdolHtml = await render(Idol, { ...idolProps, ...callbacks })
  assert.equal(elementText(readerIdolHtml, 'pre').length, 0, 'reader mode does not expose raw technical evidence')
  // Evidence preservation assertions below explicitly exercise the maintainer view.
  globalThis.location = { search: '?maintainer=1' }
  async function verifyEntityDetails(expectedName, nameCallbacks = callbacks) {
    let idolState, unitState
    const idolHtml = await render(withState(Idol, state => { idolState = state }), { ...idolProps, ...nameCallbacks })
    assert.deepEqual(elementText(idolHtml, 'h2').map(decodeHtml), [expectedName])
    const portrait = idolHtml.match(/<img\b[^>]*src="[^"]*image_chara_icon_029ass\.png"[^>]*>/)?.[0]
    assert.ok(portrait, 'the production avatar uses the canonical identity resource')
    assert.equal(decodeHtml(portrait.match(/\balt="([^"]*)"/)?.[1] || ''), expectedName,
      'the nondecorative avatar follows the displayed name')
    assert.deepEqual(technicalEvidence(idolHtml, 'idol'), { idol: profile, songs: idolSongs.map(entry => ({
      song_code: entry.song.song_code, title: entry.song.title, evidenceLabel: entry.evidenceLabel,
      performance_mapping: entry.song.performance_mapping,
    })) }, 'translated headings must not overwrite canonical technical evidence')
    assert.equal(idolState.eventItems.value.length, idolEvents.length)
    idolState.eventItems.value.forEach((item, index) => assert.equal(item.payload, idolEvents[index],
      'event navigation retains the canonical payload object'))
    const unitHtml = await render(withState(Unit, state => { unitState = state }), { ...unitProps, ...nameCallbacks })
    for (const member of unitEntry.members) {
      const name = nameCallbacks.idolName?.(member.idol_code, member.display_name) || member.display_name
      assert.ok(elementText(unitHtml, 'strong').map(decodeHtml).includes(name))
      const ariaLabels = [...unitHtml.matchAll(/aria-label="([^"]+)"/g)].map(match => decodeHtml(match[1]))
      assert.ok(ariaLabels.includes(`查看${name}的偶像资料`), 'member action label follows the same display callback')
      const projected = unitState.memberReferences.value.find(entry => entry.member.idol_code === member.idol_code)
      assert.equal(projected.member, member, 'member navigation retains the canonical member object')
      assert.equal(projected.reference.idolCode, member.idol_code)
    }
    assert.deepEqual(technicalEvidence(unitHtml, 'unit'), { unit: unitEntry.unit, songs: [], stories: [] })
    for (const [key, events] of Object.entries({
      teamEventItems: unitEntry.eventRelations.team_events,
      attributeEventItems: unitEntry.eventRelations.attribute_event_appearances,
      mixedEventItems: unitEntry.eventRelations.mixed_unit_appearances,
    })) {
      unitState[key].value.forEach((item, index) => assert.equal(item.payload, events[index],
        'unit relation navigation retains the canonical event object'))
    }
    checks += 2
  }
  async function verifyEventDetails({ sourceOnly = false, missingName = false } = {}) {
    let eventState
    const nameCalls = []
    const displayIdolName = (code, rawFallback) => {
      nameCalls.push([code, rawFallback])
      return context.idolDisplayName(code, rawFallback)
    }
    const eventName = (code, raw) => sourceOnly || locale.value === 'ja-JP' || (missingName && code === profile.idol_code)
      ? raw : overlay.entries[code]?.name || raw
    const html = await render(withState(Event, state => { eventState = state }), {
      view: eventView, ...(sourceOnly ? {} : { displayIdolName }),
    })
    const labels = [...html.matchAll(/aria-label="([^"]+)"/g)].map(match => decodeHtml(match[1]))
    const names = elementText(html, 'strong').map(decodeHtml)
    assert.equal(eventState.castReferences.value.length, eventView.castReferences.length)
    eventView.castReferences.forEach((entry, index) => {
      const projected = eventState.castReferences.value[index]
      const rawIdol = eventView.cast.find(idol => idol.idol_code === entry.idol_code)
      const displayed = eventName(entry.idol_code, entry.reference.displayName)
      if (!sourceOnly) assert.ok(nameCalls.some(([code, raw]) => code === entry.idol_code && raw === entry.reference.displayName),
        'cast supplies the canonical raw name to the existing callback')
      assert.equal(projected.idol, rawIdol, 'cast navigation retains the canonical idol object and order')
      assert.equal(projected.reference.displayName, displayed)
      for (const key of Object.keys(entry.reference).filter(key => key !== 'displayName')) {
        assert.equal(projected.reference[key], entry.reference[key], `cast reference preserves ${key}`)
      }
      assert.ok(names.includes(displayed), 'actual cast copy follows the displayed name')
      if (entry.reference.actionable) assert.ok(labels.includes(`查看${displayed}的偶像资料`))
      const firstImage = entry.reference.imageCandidates[0]?.url
      if (firstImage) assert.ok([...html.matchAll(/\bsrc="([^"]+)"/g)].some(match => decodeHtml(match[1]) === firstImage),
        'the actual cast image uses the canonical first resource candidate')
    })
    const cards = derivedCards(eventView)
    assert.equal(eventState.derivedRelationItems.value.length, cards.length)
    const metas = [...html.matchAll(/<small\b[^>]*class="[^"]*\brelation-meta\b[^"]*"[^>]*>([^]*?)<\/small>/g)]
      .map(match => decodeHtml(match[1].trim()))
    cards.forEach((card, index) => {
      const item = eventState.derivedRelationItems.value[index]
      const meta = `${eventName(card.character_id, card.character_name)} · ${card.rarity}`
      if (!sourceOnly) assert.ok(nameCalls.some(([code, raw]) => code === card.character_id && raw === card.character_name),
        'derived metadata supplies the canonical raw name to the existing callback')
      assert.equal(item.payload, card, 'derived-card navigation retains the canonical card object')
      assert.equal(item.meta, meta)
      assert.ok(metas.includes(meta), 'the actual derived-card metadata follows the displayed name')
      assert.equal(item.id, `event-derived-card:${eventView.identity.id}:${card.card_resource_id}`)
      assert.ok(html.includes(`data-archive-focus-id="relation:${item.id}"`))
      assert.equal(item.title, card.card_title)
      assert.equal(item.evidence, card.relation_type)
      assert.equal(item.resource, card.card_resource_id)
      assert.equal(item.evidenceTone, 'derived', 'localizing a name does not promote evidence')
    })
    assert.equal(eventState.rewardCards.value, eventView.rewards.cards)
    assert.deepEqual(technicalEvidence(html, 'provenance'), JSON.parse(JSON.stringify({
      provenance: eventView.provenance, file: eventView.story.entry.file,
      classification: eventView.story.entry.classification_source,
    })),
      'the actual source block retains canonical event provenance')
    const firstEpisode = eventView.episodes[0]
    const first = eventView.readingEntries.find(entry => entry.status === 'ready' && entry.source_file === firstEpisode.file)
    assert.equal(eventState.firstReading.value, first, 'overview reading stays bound to the first episode')
    assert.ok(html.includes(`data-archive-focus-id="event-read:${eventView.identity.id}:overview:${first.document_id}"`))
    for (const episode of eventView.episodes) {
      const ready = eventView.readingEntries.some(entry => entry.status === 'ready' && entry.source_file === episode.file)
      assert.equal(html.includes(`data-archive-focus-id="event-read:${eventView.identity.id}:episode:${episode.id}"`), ready)
    }
    checks++
  }
  const rewardRegion = html => html.match(/<section\b[^>]*aria-labelledby="event-rewards-title"[^>]*>([^]*?)<\/section>/)?.[1] || ''
  async function rewardRender(view, { failedMedia = false } = {}) {
    let state
    const html = await render(withState(Event, value => {
      state = value
      if (failedMedia) value.DomainMediaPreview = withState(Media, { failed: true })
    }), { view, displayIdolName: context.idolDisplayName })
    assert.equal(state.rewardCards.value, view.rewards.cards, 'the reward leaf remains the canonical card array')
    assert.deepEqual(technicalEvidence(html, 'provenance'), JSON.parse(JSON.stringify({
      provenance: view.provenance, file: view.story.entry.file,
      classification: view.story.entry.classification_source,
    })))
    const region = rewardRegion(html)
    const badges = [...region.matchAll(/<span\b[^>]*class="reward-rarity"[^>]*>([^]*?)<\/span>/g)].map(match => decodeHtml(match[1]))
    assert.deepEqual(badges, [...view.rewards.cards, ...(state.exchangeRewards.value?.cards || [])]
      .filter(entry => entry.rarity).map(entry => entry.rarity), 'badges come only from associated cards, never generic rewards')
    const openButtons = [...region.matchAll(/<button\b[^>]*class="event-reward-open"[^>]*>([^]*?)<\/button>/g)]
    assert.equal(openButtons.length, view.rewards.cards.length + (state.exchangeRewards.value?.cards.length || 0),
      'each associated reward card retains its navigation button')
    for (const [, body] of openButtons) {
      assert.ok(!/<button\b/.test(body), 'media retry stays outside the card navigation button')
      assert.ok(!body.includes('lucide-chevron-right'), 'reward navigation has no redundant row arrow')
    }
    return { state, html, region }
  }
  async function verifyRewardLabels() {
    const { state, region } = await rewardRender(rewardView)
    const storyCard = rewardView.rewards.cards.find(entry => entry.card_resource_id === '035mco_r02')
    const storyMethod = storyCard.methods.find(method => method.kind === 'story')
    const rawStoryRow = rewardView.rewards.general.find(row => row.key === storyMethod.key)
    assert.equal(rawStoryRow.episodeId, 4100120110)
    assert.equal(rewardView.episodes.find(episode => episode.id === String(rawStoryRow.episodeId)).label, 'エピソード10')
    const storyLabel = `${locale.value === 'zh-CN' ? '第10话' : 'エピソード10'} 阅读（活动期内）`
    assert.equal(state.rewardMethodLabel(storyCard, storyMethod), storyLabel)
    assert.ok(elementText(region, 'span').map(decodeHtml).includes(storyLabel),
      'the actual reward copy uses the exact source episode join')
    assert.ok(!region.includes('4100120110'), 'raw source IDs are kept out of the player-facing reward condition')
    const pointCard = rewardView.rewards.cards.find(entry => entry.card_resource_id === '037jir_sr06')
    assert.equal(state.rewardMethodLabel(pointCard, pointCard.methods[0]), '25,000 PT · ×1')
    assert.equal(state.rewardMethodLabel(storyCard, storyCard.methods[1]), '8,400 PT 起 · 4 次碎片 · 共 ×4')
    assert.ok(region.includes('25,000 PT · ×1') && region.includes('8,400 PT 起 · 4 次碎片 · 共 ×4'))
    const exchanged = await rewardRender(exchangeView)
    assert.deepEqual(exchanged.state.exchangeRewards.value.cards.map(entry => [entry.cost.amount, entry.exchangeLimit]),
      [[40, 1], [35, 1], [15, 1]], 'the Wiki costs and exchange limits remain source-bound')
    assert.ok(exchanged.region.includes('限兑 1 次 · Wiki 补录'))
    checks += 2
  }
  for (const currentLocale of ['zh-CN', 'ja-JP']) {
    locale.value = currentLocale
    renderedLocale.value = currentLocale
    const displayed = currentLocale === 'zh-CN' ? overlay.entries['029ass'].name : sourceNames['029ass']
    assert.equal(canonicalProfile.value, profile, 'the leaf profile stays canonical in both languages')
    assert.equal(displayedProfileName.value, displayed, 'Shell name is a display projection, separate from evidence')
    await verifyEntityDetails(displayed)
    await verifyEventDetails()
    await verifyRewardLabels()
    for (const query of ['阿斯兰', 'アスラン', '别西卜II世']) {
      const html = await render(withState(Picker, { query }), { idols, modelValue: '029ass', ...callbacks })
      assert.match(html, /1 位偶像/)
      assert.match(html, /data-idol-code="029ass"/)
      assert.ok(!html.includes('data-idol-code="007kei"'))
      assert.ok(elementText(html, 'strong').map(decodeHtml).includes(displayed))
      assert.ok(html.includes(`已选：${displayed}`))
      checks++
    }
    const welcome = await render(Welcome, { idols, selectionOnly: true, dataReady: true,
      preferences: { startupIdol: '029ass' }, ...callbacks })
    assert.ok(welcome.includes(`已选：${displayed}`))
    assert.ok(elementText(welcome, 'strong').map(decodeHtml).includes(displayed), 'Welcome passes the name callback to its picker')
    assert.match(welcome, /<button[^>]*aria-pressed="true"[^>]*data-idol-code="029ass"/)
    checks++
    const ownerName = context.idolDisplayName('001tom', owner.displayName)
    assert.equal(displayedOwner.value.displayName, ownerName)
    for (const key of Object.keys(owner).filter(key => key !== 'displayName')) {
      assert.equal(displayedOwner.value[key], owner[key], `owner preserves ${key}`)
    }
    const cardHtml = await render(Card, { card, ownerReference: displayedOwner.value, embedded: true })
    assert.equal(elementText(cardHtml, 'strong').map(decodeHtml).filter(text => text === ownerName).length, 1,
      'card identity shows its canonical owner once')
    assert.equal((cardHtml.match(new RegExp(`data-archive-focus-id="card-owner:${card.resource_id}:head"`, 'g')) || []).length, 1)
    assert.ok(cardHtml.includes(`aria-label="查看${ownerName}的偶像资料"`))
    const performers = await render(Song, { song: altessimo, ...callbacks })
    for (const code of ['007kei', '008rei']) {
      assert.ok(performers.includes(`aria-label="查看${context.idolDisplayName(code)}的偶像资料"`))
      assert.ok(performers.includes(`data-archive-focus-id="song-performer:${altessimo.id}:${code}"`))
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
  assert.ok(elementText(fallback, 'strong').map(decodeHtml).includes(sourceNames['029ass']))
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
  // Explicit missing-translation fixture: remove only Aslan from a copy of the
  // real overlay, then run the production repository and callback fallback.
  const missingNameOverlay = structuredClone(overlay)
  delete missingNameOverlay.entries[profile.idol_code]
  const missingNameRepository = new EntityTranslationRepository({
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify(missingNameOverlay) }),
  })
  await missingNameRepository.loadEntity({ entityType: 'idol', locale: 'zh-CN', sourceNames: IDOL_ID_TO_NAME })
  locale.value = 'zh-CN'
  renderedLocale.value = 'zh-CN'
  context.entityTranslationRepository = missingNameRepository
  context.idolEntityTranslationRevision.value++
  assert.equal(displayedProfileName.value, profile.display_name, 'missing translation falls back to the canonical name')
  await verifyEntityDetails(profile.display_name)
  await verifyEntityDetails(profile.display_name, {})
  await verifyEventDetails({ missingName: true })
  await verifyEventDetails({ sourceOnly: true })
  // Controlled guard fixture, explicitly copied from the real event: later ready
  // chapters must not silently replace an unsupported first overview chapter.
  const unsupportedFirstView = structuredClone(eventView)
  const firstFile = unsupportedFirstView.episodes[0].file
  unsupportedFirstView.readingEntries = unsupportedFirstView.readingEntries.map(entry =>
    entry.source_file === firstFile ? { ...entry, status: 'unsupported' } : entry)
  assert.ok(unsupportedFirstView.readingEntries.some(entry => entry.status === 'ready'),
    'the controlled guard fixture retains at least one later ready chapter')
  let unsupportedFirstState
  const unsupportedHtml = await render(withState(Event, state => { unsupportedFirstState = state }), {
    view: unsupportedFirstView, displayIdolName: context.idolDisplayName,
  })
  assert.equal(unsupportedFirstState.firstReading.value, undefined)
  assert.ok(!unsupportedHtml.includes(`data-archive-focus-id="event-read:${eventView.identity.id}:overview:`),
    'the unsupported first chapter cannot acquire an overview entry from a later chapter')
  assert.ok(!unsupportedHtml.includes(`data-archive-focus-id="event-read:${eventView.identity.id}:episode:${unsupportedFirstView.episodes[0].id}"`))
  const laterEpisode = unsupportedFirstView.episodes.find(episode => unsupportedFirstState.readingByFile.value.has(episode.file))
  assert.ok(unsupportedHtml.includes(`data-archive-focus-id="event-read:${eventView.identity.id}:episode:${laterEpisode.id}"`),
    'a later ready chapter retains its own reading action')
  checks++
  // Controlled unsupported fixtures copied from the actual reward consumer.
  // These changed keys/episode references are guard inputs, not archived rewards.
  for (const corrupt of [
    view => { view.rewards.cards.find(entry => entry.card_resource_id === '035mco_r02').methods[0].key = 'unsupported-key' },
    view => { view.episodes = view.episodes.filter(episode => episode.id !== '4100120110') },
    view => {
      const method = view.rewards.cards.find(entry => entry.card_resource_id === '035mco_r02').methods[0]
      view.rewards.general.push(structuredClone(view.rewards.general.find(row => row.key === method.key)))
    },
  ]) {
    const unsupported = structuredClone(rewardView)
    corrupt(unsupported)
    const { state, region } = await rewardRender(unsupported)
    const sourceCard = unsupported.rewards.cards.find(entry => entry.card_resource_id === '035mco_r02')
    assert.equal(state.rewardMethodLabel(sourceCard, sourceCard.methods[0]), sourceCard.methods[0].label)
    assert.ok(region.includes(sourceCard.methods[0].label), 'an unresolved or ambiguous join retains the existing source label')
    checks++
  }
  // A controlled repeated-card boundary copies an actual repeated reward row,
  // changes only its target/type, and is explicitly not a published association.
  const repeated = eventProduct.extraDomains.events.records.flatMap(record => record.view.rewards.general)
    .find(row => row.scope === 'repeated' && Number.isFinite(row.intervalPoint) && Number.isFinite(row.limitPoint))
  assert.ok(repeated)
  const repeatedView = structuredClone(rewardView)
  const repeatedCard = repeatedView.rewards.cards[0]
  const repeatedRow = { ...structuredClone(repeated), key: 'controlled-repeated-card', offsetPoint: 0,
    product: { ...structuredClone(repeated.product), kind: 'card', amount: 0, target: { view: 'card_detail', card: repeatedCard.card_resource_id } } }
  repeatedView.rewards.general.push(repeatedRow)
  repeatedCard.methods.push({ key: repeatedRow.key, kind: 'point', label: '原始重复报酬' })
  const repeatedRender = await rewardRender(repeatedView)
  assert.equal(repeatedRender.state.rewardMethodLabel(repeatedCard, repeatedCard.methods.at(-1)),
    `每 ${repeatedRow.intervalPoint.toLocaleString('zh-CN')} PT · 起点 0 PT · 上限 ${repeatedRow.limitPoint.toLocaleString('zh-CN')} PT · ×0`,
    'repeated intervals, zero origin/quantity and explicit upper limits survive compact display')
  const failedReward = await rewardRender(rewardView, { failedMedia: true })
  for (const sourceCard of rewardView.rewards.cards) {
    assert.ok(failedReward.region.includes(`aria-label="重试图片 ${sourceCard.card_title}"`),
      'the actual failed thumbnail retains its independent retry control')
  }
  checks += 2
  context.currentCharacterId.value = '001tom'
  assert.equal(canonicalProfile.value, null, 'a stale profile cannot supply a different selected identity')
  assert.equal(displayedProfileName.value, '', 'the stale profile cannot leave a name in the Shell')
  assert.equal(evidenceBefore, sourceEvidence(), 'display never mutates source evidence or media tracks')
  checks++
  console.log(`Idol localization: ${checks} SFC render scenarios passed; terminal/card/performer/Solo/lineup and idol/unit/event detail display, bilingual search, 49 track IDs, avatar alt, canonical event resources/rewards/evidence/payloads, source-bound reward episode/point/fragment labels, Wiki exchange limits, independent thumbnail retry, first-episode reading guard, and source/missing-translation/empty/stale fallbacks. No DOM, pinned read-model bytes or playback acceptance is implied.`)
} finally {
  if (renderedLocale) renderedLocale.value = previousRenderedLocale
  if (previousDocument === undefined) delete globalThis.document
  else globalThis.document = previousDocument
  if (previousLocation === undefined) delete globalThis.location
  else globalThis.location = previousLocation
  await server.close()
}
