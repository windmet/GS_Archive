import assert from 'node:assert/strict'
import fs from 'node:fs'
import { archiveHomeStateStats, buildArchiveHomeState } from '../src/data/archiveHomeState.js'

const readJson = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'))
const idolUnit = readJson('../public/data/masterdata/idol_unit_dictionary.json')
const cardIndex = readJson('../public/data/masterdata/card_index.json')
const manifest = readJson('../public/data/archive_manifest.json')

const idols = buildArchiveHomeState(idolUnit, cardIndex, manifest)
const stats = archiveHomeStateStats(idols)

assert.equal(stats.idols, 49)
assert.equal(stats.cues, 2564)
assert.equal(stats.playable, 2564)
assert.equal(stats.backgrounds, 1)
assert.equal(stats.models, 57)

const toma = idols.find(idol => idol.id === '001tom')
assert.ok(toma)
assert.equal(toma.unitName, 'Jupiter')
assert.equal(toma.cues[0].cardId, '001tom_n01')
assert.equal(toma.cues[0].voice, '2_1_001_01_00_09.m4a')
assert.equal(toma.cues[0].background, 'bg001_315pro_in_01')
assert.equal(toma.cues[0].modelId, '001tom_002_00')
assert.equal(toma.cues[0].previewStep.state.spines[0].id, '001tom')

console.log(`Archive home state: ${stats.idols} idols, ${stats.cues} cues, ${stats.models} models`)
