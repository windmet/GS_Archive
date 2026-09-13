import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { presentCardAssetRows, presentCardCostumeRelations } from '../src/presentation/CardDetailSemantics.js'

const read = path => JSON.parse(readFileSync(new URL(`../public/data/${path}`, import.meta.url), 'utf8'))
const cards = read('masterdata/card_index.json').cards
const details = read('masterdata/card_detail_index.json').cards_by_resource_id
let nonSSR = 0
let ssr = 0
for (const card of cards) {
  const rows = presentCardAssetRows(card, {})
  const ssrRows = rows.filter(row => row.label.includes('SSR 横图'))
  if (card.rarity === 'SSR' && !card.single_state) { assert.equal(ssrRows.length, 2); ssr += 1 }
  else { assert.equal(ssrRows.length, 0); nonSSR += 1 }
}
assert.ok(nonSSR > 0 && ssr > 0)
assert.equal(presentCardCostumeRelations(details['001tom_r01'].costume_relations).length, 0,
  'default-only card does not claim a specific costume')
assert.ok(presentCardCostumeRelations(details['001tom_r03'].costume_relations).length > 0,
  'card-specific Live/Story slot remains visible')
assert.ok(presentCardCostumeRelations(details['001tom_ssr01'].costume_relations).length > 0)
for (const detail of Object.values(details)) {
  const shown = presentCardCostumeRelations(detail.costume_relations)
  assert.ok(shown.every(item => !item.slot.startsWith('home_')), 'homepage default is technical evidence only')
}
const source = readFileSync(new URL('../src/components/archive/ArchiveCardDetail.vue', import.meta.url), 'utf8')
assert.match(source, /visibleCostumes\.length/)
assert.match(source, /presentCardAssetRows\(props\.card, props\.assetStatus\)/)
console.log(`Card detail semantics: ${nonSSR} non-SSR/single cards without N-A rows, ${ssr} SSR cards and slot-filtered costumes passed`)
