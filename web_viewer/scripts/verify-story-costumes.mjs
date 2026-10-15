// Unnamed story costumes: site labels, the home list (src/data/storyCostumes.json) and the rendered
// thumbnails for models the client ships no usable icon for (src/data/costumeRenderThumbs.json).
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { UNNAMED_COSTUME_LABELS, storyCostumeLabel } from '../src/presentation/costumeSeries.js'

const readJson = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'))
const readSource = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const dictionary = readJson('../public/data/masterdata/costume_dictionary.json').by_model_resource_id
const catalog = readJson('../public/data/masterdata/domains/costume_catalog.json').entries
const stories = readJson('../src/data/storyCostumes.json').costumes
const renders = readJson('../src/data/costumeRenderThumbs.json').thumbs

execFileSync(process.execPath, [fileURLToPath(new URL('build-story-costumes.mjs', import.meta.url)), '--check'], { stdio: 'pipe' })

// Every unnamed model with a spine has a label, and every explicit label names such a model.
const unnamed = Object.values(dictionary).filter(costume => costume.spine_exists === true && !String(costume.costume_name || '').trim())
assert.deepEqual(unnamed.filter(costume => !storyCostumeLabel(costume.model_resource_id)).map(costume => costume.model_resource_id), [])
for (const modelId of Object.keys(UNNAMED_COSTUME_LABELS)) {
  assert.equal(dictionary[modelId]?.spine_exists, true, modelId)
  assert.ok(!String(dictionary[modelId].costume_name || '').trim(), `${modelId} has a client name`)
}
assert.equal(stories.length, unnamed.length)
assert.equal(storyCostumeLabel('010pie_001_00'), '青蛙玩偶装')
assert.equal(storyCostumeLabel('001tom_004_00'), '运动服')
assert.equal(storyCostumeLabel('001tom_004_01'), '运动服 2')

// The client table swaps the twins' sportswear rows; the home list follows the model id.
for (const [modelId, idolCode, tableIdolCode] of [['012yus_004_00', '012yus', '013kys'], ['013kys_004_00', '013kys', '012yus']]) {
  assert.equal(dictionary[modelId].idol_code, tableIdolCode)
  assert.deepEqual(stories.filter(costume => costume.modelId === modelId).map(costume => [costume.idolCode, costume.tableIdolCode]), [[idolCode, tableIdolCode]])
}

// Thumbnails: every catalog model without an icon has a render, plus the one with a wrong icon.
const iconless = catalog.filter(entry => entry.image?.status === 'file-not-found').map(entry => entry.id).sort()
assert.deepEqual(Object.keys(renders).filter(modelId => !renders[modelId].replacesIcon).sort(), iconless)
assert.deepEqual(Object.keys(renders).filter(modelId => renders[modelId].replacesIcon), ['037jir_108_00'])
assert.equal(renders['010pie_001_00'].framing, 'full-figure')
let checkedFiles = 0
for (const [modelId, render] of Object.entries(renders)) {
  assert.ok(stories.some(costume => costume.modelId === modelId), `${modelId} is not on the home stage list`)
  assert.equal(render.url, `/assets/costume-renders/${modelId}.png`)
  assert.match(render.sha256, /^[a-f0-9]{64}$/)
  const file = new URL(`../public${render.url}`, import.meta.url)
  // The PNGs are ignored media; check them where they are present.
  if (fs.existsSync(file)) {
    const data = fs.readFileSync(file)
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'), render.sha256, modelId)
    assert.deepEqual([data.readUInt32BE(16), data.readUInt32BE(20)], [render.width, render.height])
    checkedFiles++
  }
}

// Consumers: the collection list and detail use the renders, and the home merges the list into older profiles.
assert.match(readSource('../src/components/archive/ArchiveCollectionCatalog.vue'), /costumeImage\(row\.id,row\.image\)/)
assert.match(readSource('../src/components/archive/CollectionEntryDetails.vue'), /costumeImage\(detail\.entry\?\.id,detail\.media\?\.image\)/)
assert.match(readSource('../src/App.vue'), /withStoryCostumes\(homeReadModelProfiles\.value\[idol\.id\] \|\| idol, storyCostumeData\.costumes\)/)

console.log(`Story costumes verified: ${stories.length} labelled models, ${Object.keys(renders).length} rendered thumbnails (${checkedFiles} files checked locally)`)
