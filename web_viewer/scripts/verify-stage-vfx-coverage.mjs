import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildStageVfxCoverage } from '../src/core/stageVfxCoverage.js'

const json = path => JSON.parse(readFileSync(new URL(`../public/assets/live-chibi/${path}`, import.meta.url), 'utf8'))
const songs = json('choreography/index.json').songs
const indexes = {
  backmonitor: json('backmonitor/index.json'),
  imageLayers: json('image-layers/index.json'),
  objectLayers: json('object-layers/index.json'),
  stageEffects: json('stage-effects/index.json'),
}
const coverages = songs.map(song => buildStageVfxCoverage(song, indexes))
assert.equal(coverages.length, 118)
const byId = Object.fromEntries(coverages.map(entry => [entry.songId, entry]))
assert.deepEqual(byId.drvalv_live_effect.objectParticles,
  ['fx_in_drvalv_panel', 'fx_in_tfmvmt_Incidentlight'])
assert.deepEqual(byId.brndnf_live_effect.objectParticles, ['fx_in_brndnf_ring'])
assert.equal(byId.anwhre_live_effect.objectSprites.length, 5)
assert.equal(byId.anwhre_live_effect.objectParticles.length, 3)
assert.equal(byId.anwhre_live_effect.status, 'partial')
assert.equal(coverages.flatMap(entry => entry.missingMedia).length, 0)
const synthetic = buildStageVfxCoverage({
  id: 'synthetic', objectLayerEvents: [{ asset: 'missing_object' }, { asset: 'unknown_kind' }],
  backmonitorEvents: [{ movie: 'missing_movie' }], imageLayerEvents: [{ asset: 'missing_image' }],
}, { ...indexes, objectLayers: { assets: { unknown_kind: { kind: 'unknown' } } } })
assert.deepEqual(synthetic.objectMissing, ['missing_object'])
assert.deepEqual(synthetic.objectOther, ['unknown_kind'])
assert.deepEqual(synthetic.missingMedia, ['missing_movie', 'missing_image'])
assert.equal(synthetic.status, 'partial')
console.log(`Stage VFX coverage: ${coverages.length} arrangements, ${coverages.filter(entry => entry.status === 'partial').length} with unsupported or missing layers; raw source status only`)
