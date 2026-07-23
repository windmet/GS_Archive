import assert from 'node:assert/strict'
import fs from 'node:fs'
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

console.log(`Archive home state: ${stats.idols} idols, ${stats.cues} cues, ${stats.models} models, ${highlights.length} highlights; standalone background owner verified`)
