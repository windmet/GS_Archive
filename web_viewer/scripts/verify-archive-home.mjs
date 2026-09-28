import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {
  archiveHomeStateStats,
  buildArchiveHomeHighlights,
  buildArchiveHomeState,
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
assert.equal(stats.cues, 2564)
assert.equal(stats.playable, 2564)
assert.equal(stats.backgrounds, 1)
assert.equal(stats.models, 57)

for (const background of new Set(idols.flatMap(idol => idol.cues).map(cue => cue.background).filter(Boolean))) {
  assert.ok(fs.existsSync(new URL(`../public/assets/bg/${background}.png`, import.meta.url)), background)
}

const toma = idols.find(idol => idol.id === '001tom')
assert.ok(toma)
assert.equal(toma.unitName, 'Jupiter')
assert.equal(toma.cues[0].cardId, '001tom_n01')
assert.equal(toma.cues[0].voice, '2_1_001_01_00_09.m4a')
assert.equal(toma.cues[0].background, 'bg001_315pro_in_01')
assert.equal(toma.cues[0].modelId, '001tom_002_00')
assert.equal(toma.cues[0].previewStep.state.spines[0].id, '001tom')
assert.equal(toma.costumes.length, 12)
assert.equal(toma.costumes[0].name, 'ベーシックウェア')
assert.equal(toma.costumes[0].modelId, '001tom_002_00')
assert.equal(idols.flatMap(idol => idol.costumes).length, 601)

const highlights = buildArchiveHomeHighlights(manifest, uiAssets)
assert.equal(highlights.length, 36)
assert.equal(highlights[0].event_id, 430018)
assert.equal(highlights[0].event_code, '30018')
assert.equal(highlights[0].scopeLabel, '固定组合团活')
assert.equal(highlights[1].event_id, 410018)
assert.equal(highlights[1].scopeLabel, '跨组合团活')
for (const highlight of highlights) {
  assert.ok(fs.existsSync(new URL(`../public${highlight.bannerUrl}`, import.meta.url)), highlight.bannerUrl)
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
assert.doesNotMatch(immersiveHomeSource, /home-highlight|activeHighlight|stepHighlight/)

console.log(`Archive home state: ${stats.idols} idols, ${stats.cues} cues, ${stats.models} models, ${highlights.length} highlights; standalone background owner and read-model projection verified`)
