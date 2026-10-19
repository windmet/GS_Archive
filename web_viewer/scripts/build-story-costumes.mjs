// Unnamed story costumes with a site label (src/presentation/costumeSeries.js) for the home costume picker.
// Prebuilt home profiles in older read models predate these entries; the client merges this list in.
// Usage: node scripts/build-story-costumes.mjs [--check]
import fs from 'node:fs'
import { storyCostumeLabel } from '../src/presentation/costumeSeries.js'

const root = new URL('..', import.meta.url)
const dictionary = JSON.parse(fs.readFileSync(new URL('public/data/masterdata/costume_dictionary.json', root), 'utf8'))
const target = new URL('src/data/storyCostumes.json', root)
const costumes = Object.values(dictionary.by_model_resource_id)
  .filter(costume => costume?.idol_code && costume.spine_exists && !String(costume.costume_name || '').trim() && storyCostumeLabel(costume.model_resource_id))
  .map(costume => ({
    // The twins' sportswear rows are swapped in the client table (1012002 -> 013kys_004_00, 1013001 ->
    // 012yus_004_00); a model draws the idol its id names, so that idol owns it on the home stage.
    idolCode: costume.model_resource_id.slice(0, 6),
    ...(costume.idol_code !== costume.model_resource_id.slice(0, 6) ? { tableIdolCode: costume.idol_code } : {}),
    modelId: costume.model_resource_id,
    costumeId: costume.costume_id,
    releaseAt: costume.release_at,
    sourceTables: costume.source_tables || [],
  }))
  .sort((left, right) => left.modelId.localeCompare(right.modelId))
const text = JSON.stringify({ schema: 'GS-STORY-COSTUMES-V1', costumes }, null, 1) + '\n'
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== text) throw new Error('src/data/storyCostumes.json is stale; run node scripts/build-story-costumes.mjs')
  console.log(`story costumes current: ${costumes.length}`)
} else {
  fs.writeFileSync(target, text)
  console.log(`${costumes.length} story costumes -> src/data/storyCostumes.json`)
}
