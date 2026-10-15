import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {
  archiveHomeStateStats,
  buildArchiveHomeHighlights,
  buildArchiveHomeState,
  withStoryCostumes,
} from '../src/data/archiveHomeState.js'

const readJson = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'))
const idolUnit = readJson('../public/data/masterdata/idol_unit_dictionary.json')
const cardIndex = readJson('../public/data/masterdata/card_index.json')
const costumeDictionary = readJson('../public/data/masterdata/costume_dictionary.json')
const manifest = readJson('../public/data/archive_manifest.json')
const uiAssets = readJson('../public/data/assets/ui_asset_catalog.json')
const readSource = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

const idols = buildArchiveHomeState(idolUnit, cardIndex, manifest, costumeDictionary)
const stats = archiveHomeStateStats(idols)

assert.equal(stats.idols, 49)
assert.equal(stats.cues, 2356)
assert.equal(stats.playable, 2356)
// Different source records can point at the same home cue. Every distinct
// playable cue must survive, while each idol's directory identity stays unique.
for (const idol of idols) {
  const sourceCues = new Set(cardIndex.cards
    .filter(card => card.character_id === idol.id)
    .flatMap(card => card.home_voice_cues || [])
    .filter(cue => cue.preview?.preview_step?.state && cue.preview?.voice)
    .map(cue => cue.cue))
  assert.equal(new Set(idol.cues.map(cue => cue.cue)).size, idol.cues.length, idol.id)
  assert.deepEqual(new Set(idol.cues.map(cue => cue.cue)), sourceCues, idol.id)
}
assert.equal(stats.backgrounds, 1)
assert.equal(stats.models, 57)

for (const background of new Set(idols.flatMap(idol => idol.cues).map(cue => cue.background).filter(Boolean))) {
  assert.match(background, /^[a-z0-9_]+$/, background)
}

const toma = idols.find(idol => idol.id === '001tom')
assert.ok(toma)
assert.equal(toma.unitName, 'Jupiter')
assert.equal(toma.cues[0].cardId, '001tom_n01')
assert.equal(toma.cues[0].voice, '2_1_001_01_00_09.m4a')
assert.equal(toma.cues[0].background, 'bg001_315pro_in_01')
assert.equal(toma.cues[0].modelId, '001tom_002_00')
assert.equal(toma.cues[0].previewStep.state.spines[0].id, '001tom')
// Unnamed story costumes join under a site label (src/presentation/costumeSeries.js): 001tom_003_00, _004_00, _004_01.
assert.equal(toma.costumes.length, 15)
assert.deepEqual(toma.costumes.filter(costume => costume.name.endsWith('（剧情）')).map(costume => [costume.modelId, costume.name]),
  [['001tom_003_00', '秋冬便服（剧情）'], ['001tom_004_00', '运动服（剧情）'], ['001tom_004_01', '运动服 2（剧情）']])
assert.equal(toma.costumes[0].name, 'ベーシックウェア')
assert.equal(toma.costumes[0].modelId, '001tom_002_00')
// Every costume-catalog model (690); 047shu_002_00 was already present as Shu's scene default.
assert.equal(idols.flatMap(idol => idol.costumes).length, 690)
const costumeOf = (idolCode, modelId) => idols.find(idol => idol.id === idolCode).costumes.find(costume => costume.modelId === modelId)
assert.equal(costumeOf('010pie', '010pie_001_00')?.name, '青蛙玩偶装（剧情）')
// The client table swaps the twins' sportswear rows; each model stays with the idol it draws.
assert.equal(costumeOf('012yus', '012yus_004_00')?.name, '运动服（剧情）')
assert.equal(costumeOf('013kys', '013kys_004_00')?.name, '运动服（剧情）')
assert.equal(costumeOf('013kys', '012yus_004_00'), undefined)

// Actual source scene defaults do not all have the same availability. The
// unnamed Shu rig is present; Hayato/Eishin source cues reference absent rigs.
const sceneDefaults = idols.flatMap(idol => idol.costumes).filter(costume => costume.isSceneDefault)
assert.deepEqual(sceneDefaults.map(costume => costume.modelId), ['047shu_002_00'])
assert.equal(costumeDictionary.by_model_resource_id['047shu_002_00'].spine_exists, true)
assert.ok(!costumeDictionary.by_model_resource_id['047shu_002_00'].costume_name)
for (const [idolCode, modelId] of [['020hay', '020hay_002_00'], ['049eis', '049eis_002_00']]) {
  const idol = idols.find(idol => idol.id === idolCode)
  assert.equal(costumeDictionary.by_model_resource_id[modelId], undefined)
  assert.ok(idol.cues.some(cue => cue.modelId === modelId), 'source cue/model evidence remains intact')
  assert.ok(!idol.costumes.some(costume => costume.modelId === modelId), 'absent rig is not offered as a selectable costume')
  assert.ok(idol.costumes.length > 0, 'the actual idol retains known available costumes for the existing render fallback')
}
for (const costume of idols.flatMap(idol => idol.costumes)) {
  assert.equal(costumeDictionary.by_model_resource_id[costume.modelId].spine_exists, true)
}
const legacyIdols = buildArchiveHomeState(idolUnit, cardIndex, manifest)
assert.deepEqual(idols.map(idol => idol.cues), legacyIdols.map(idol => idol.cues),
  'availability only changes selectable costumes; every cue, text, preview step and original model is preserved')
assert.deepEqual(archiveHomeStateStats(legacyIdols), stats)
for (const modelId of ['020hay_002_00', '049eis_002_00']) {
  assert.ok(legacyIdols.some(idol => idol.costumes.some(costume => costume.modelId === modelId)),
    'the legacy call without an availability dictionary keeps its source-default behavior')
}

// Labeled boundary fixture: one real cue/default from the actual Shu source.
// A missing/false/non-Boolean availability must not promise a selectable rig.
const shuCard = cardIndex.cards.find(card => card.character_id === '047shu' &&
  card.home_voice_cues.some(cue => cue.preview?.preview_step?.state.spines?.[0]?.model === '047shu_002_00'))
const fixtureCards = { by_character: { '047shu': {} }, cards: [shuCard] }
const fixtureDictionary = value => ({ by_model_resource_id: {
  '047shu_002_00': { ...costumeDictionary.by_model_resource_id['047shu_002_00'], spine_exists: value },
} })
const fixtureHome = dictionary => buildArchiveHomeState(idolUnit, fixtureCards, manifest, dictionary)[0]
const availableDefault = fixtureHome(fixtureDictionary(true))
assert.ok(availableDefault.costumes.some(costume => costume.modelId === '047shu_002_00' && costume.isSceneDefault))
for (const dictionary of [{ by_model_resource_id: {} }, fixtureDictionary(false), fixtureDictionary('true')]) {
  const unavailableDefault = fixtureHome(dictionary)
  assert.deepEqual(unavailableDefault.costumes, [])
  assert.deepEqual(unavailableDefault.cues, availableDefault.cues)
}
assert.deepEqual(fixtureHome().cues, availableDefault.cues)
assert.ok(fixtureHome().costumes.some(costume => costume.modelId === '047shu_002_00'))

const highlights = buildArchiveHomeHighlights(manifest, uiAssets)
assert.equal(highlights.length, 36)
assert.equal(highlights[0].event_id, 430018)
assert.equal(highlights[0].event_code, '30018')
assert.equal(highlights[0].scopeLabel, '固定组合团活')
assert.equal(highlights[1].event_id, 410018)
assert.equal(highlights[1].scopeLabel, '跨组合团活')
for (const highlight of highlights) {
  assert.match(highlight.bannerUrl, /^\/assets\/events\/banners\/[a-z0-9_]+\.png$/, highlight.bannerUrl)
  assert.equal(highlight.bannerUrl, uiAssets.featured_sets.event_banner_urls[highlight.event_code])
}

const immersiveHomeSource = readSource('../src/components/archive/ArchiveImmersiveHome.vue')
const spineStageSource = readSource('../src/components/SpineStage.vue')
const sceneApplicationSource = readSource('../src/core/applyStepSceneState.js')
assert.match(immersiveHomeSource, /:manage-background="true"/,
  'the standalone archive home must explicitly own its Pixi background')
assert.match(spineStageSource, /manageBackground:\s*\{\s*type:\s*Boolean,\s*default:\s*false\s*\}/,
  'SpineStage background ownership must remain opt-in')
assert.match(spineStageSource, /data-background-owner/,
  'the browser must expose the active SpineStage background ownership contract')
assert.doesNotMatch(sceneApplicationSource, /manager\.(?:setBackground|clearBackground)/,
  'generic story scene application must not regain a duplicate background owner')

const appSource = readSource('../src/App.vue')
const projectionStart = appSource.indexOf('const archiveStats = computed(')
const projectionEnd = appSource.indexOf('const idolPickerLabel = computed(', projectionStart)
assert.ok(projectionStart >= 0 && projectionEnd > projectionStart)
const context = vm.createContext({
  computed: fn => ({ get value() { return fn() } }),
  homeReadModelIndex: { value: null }, homeReadModelProfiles: { value: {} },
  archiveBootstrap: { idols: [{ id: '001tom', home_available: true }, { id: 'hidden', home_available: false }] },
  userPreferences: { value: { preferredIdol: '001tom' } },
  bootstrapIdolDictionary: { source: 'bootstrap-idols' },
  bootstrapMembership: { source: 'bootstrap-membership' },
  buildIdolReference: (_id, dictionary, membership) => ({ dictionary, membership }),
  withStoryCostumes, storyCostumeData: readJson('../src/data/storyCostumes.json'),
})
const projections = vm.runInContext(`${appSource.slice(projectionStart, projectionEnd)}\n;[
  archiveStats, archiveHomeIdols, preferredArchiveIdolReference
]`, context)
assert.equal(projections[0].value.length, 0)
assert.deepEqual(Array.from(projections[1].value, idol => idol.id), ['001tom'])
assert.equal(projections[2].value.dictionary.source, 'bootstrap-idols')
context.homeReadModelIndex.value = {
  stats: [{ label: '剧情文件', value: 12 }],
  idols: [{ id: '001tom', name: '冬馬' }], highlights: [{ event_id: 1 }],
}
assert.equal(projections[0].value[0].value, 12)
assert.equal(projections[1].value[0].name, '冬馬')
// Profiles prebuilt by an older read model gain the labelled story costumes, sorted after the scene default.
const oldToma = { ...toma, costumes: toma.costumes.filter(costume => !costume.siteLabel) }
context.homeReadModelProfiles.value = { '001tom': oldToma }
assert.deepEqual(projections[1].value[0].costumes, toma.costumes)
assert.deepEqual(withStoryCostumes(toma, context.storyCostumeData.costumes), toma)
assert.doesNotMatch(immersiveHomeSource, /home-highlight|activeHighlight|stepHighlight/)

console.log(`Archive home state: ${stats.idols} idols, ${stats.cues} cues, ${stats.models} models, ${highlights.length} highlights; standalone background owner and read-model projection verified`)
