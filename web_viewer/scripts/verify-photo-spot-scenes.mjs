import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { photoSceneSpot, photoSpotScene, photoSpotScenes, photoSpotVariantKeys, photoSpotVariants, photoVariantKey } from '../src/presentation/photoSpotScenes.js'
import { STUDIO_WEB_FILTERS, studioFilterCss } from '../src/core/PictureStudioPolicy.mjs'

// Spots own their scenes. The photo catalogue and the studio's material picker read that structure
// through one module; the studio's filter previews and its stage read one filter table.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const materials = JSON.parse(read('public/data/masterdata/domains/photo_materials.json'))
assert.ok(materials.spots.length > 100 && materials.scenes.length > materials.spots.length, 'real spot and scene corpus')

let linked = 0
for (const spot of materials.spots) {
  const scenes = photoSpotScenes(materials, spot)
  assert.deepEqual(scenes.map(row => row.id), materials.sceneIdsBySpotId[spot.id] || [], `spot ${spot.id} scenes follow sceneIdsBySpotId`)
  linked += scenes.length
  for (const scene of scenes) assert.equal(photoSceneSpot(materials, scene.id), spot, `scene ${scene.id} belongs to spot ${spot.id}`)
  for (const key of photoSpotVariantKeys(materials, spot)) {
    const scene = photoSpotScene(materials, spot, key)
    assert.equal(photoVariantKey(scene.name), key, `spot ${spot.id} opens on its ${key} scene`)
  }
  assert.equal(photoSpotScene(materials, spot, '__none__')?.id ?? null, scenes[0]?.id ?? null, `spot ${spot.id} falls back to its first scene`)
}
assert.equal(photoVariantKey('通常2'), '通常')

const variants = photoSpotVariants(materials)
assert.ok(variants.length >= 3 && variants.every(row => row.count > 1), 'shared variants only')
assert.deepEqual(variants.map(row => row.count), [...variants.map(row => row.count)].sort((a, b) => b - a), 'most common first')
for (const row of variants) assert.equal(row.count, materials.spots.filter(spot => photoSpotVariantKeys(materials, spot).includes(row.id)).length)

for (const file of ['src/components/archive/ArchivePhotoCatalog.vue', 'src/components/archive/PictureStudio.vue']) {
  const source = read(file)
  assert.ok(source.includes("from '../../presentation/photoSpotScenes.js'"), `${file} reads spots through the shared module`)
  assert.ok(!source.includes('sceneIdsBySpotId'), `${file} keeps no copy of the spot-scene lookup`)
}

for (const filter of materials.filters) assert.notEqual(studioFilterCss(filter.resourceId), 'none', `filter ${filter.resourceId} has a web approximation`)
const stage = read('src/core/StudioCompositionStage.js')
assert.ok(stage.includes('STUDIO_WEB_FILTERS[resourceId]'), 'the stage builds filters from the shared table')
assert.ok(!/sepia_light"\s*\?/.test(stage), 'the stage keeps no filter strengths of its own')
assert.equal(studioFilterCss('sepia_light'), `sepia(${STUDIO_WEB_FILTERS.sepia_light.strength})`)

console.log(`Photo spot scenes: ${materials.spots.length} spots own ${linked} scene links, ${variants.length} shared variants; catalogue and studio share the module; ${materials.filters.length} filters from one table`)
