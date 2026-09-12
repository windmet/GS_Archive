import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { filterArchiveCards } from '../src/data/cardFilters.js'
import { buildCardMap } from '../src/data/archiveSelectors.js'

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const cards = [...buildCardMap(read('../public/data/masterdata/card_index.json')).values()]
const manifest = read('../public/data/archive_manifest.json')
const gasha = read('../public/data/masterdata/gasha_index.json')
const context = { assets: manifest.card_assets_by_id, eventRelations: manifest.event_card_relations_by_card, gashaRelations: gasha.relations_by_card }
const baselinePath = process.argv[2]
const baseline = baselinePath ? new Function('cards', 'options', `
  const currentCards = {value:cards}, filterQuery = {value:options.query}, currentCardRarity = {value:options.rarity},
    currentCardAssetState = {value:options.assetState}, currentCardRelationState = {value:options.relationState};
  const archiveManifestData = {value:{card_assets_by_id:options.assets,event_card_relations_by_card:options.eventRelations}},
    gashaIndexData = {value:{relations_by_card:options.gashaRelations}};
  const computed = fn => fn();
  ${readFileSync(baselinePath, 'utf8')}
  return filteredCards;
`) : null
const digest = createHash('sha256')
let cases = 0
for (const rarity of ['all', ...new Set(cards.map(card => card.rarity))]) {
  for (const assetState of ['all', 'visible_icon', 'complete_icons', 'single_state', 'has_large', 'missing_normal', 'unknown']) {
    for (const relationState of ['all', 'card_story', 'event_card', 'gasha_card', 'release_series', 'unrelated', 'unknown']) {
      for (const query of ['', 'SSR', '001', 'チュートリアル', 'unlikely-missing-title']) {
        const options = { ...context, rarity, assetState, relationState, query }
        const result = filterArchiveCards(cards, options)
        if (baseline) assert.deepEqual(result, baseline(cards, options))
        digest.update(JSON.stringify([rarity, assetState, relationState, query, result.map(card => card.resource_id)]))
        cases++
      }
    }
  }
}
const hash = digest.digest('hex')
if (!baseline) assert.equal(hash, 'd85379ca28eb7ee573ea8c18463214f39180ec8ef43dea76986f95ed4b9d9b45')
const fixture = [{ resource_id: 'one', title: 'FIRST', rarity: 'R' }, { resource_id: 'two', rarity: 'SSR', scenario_entries: [{}] }]
const before = JSON.stringify(fixture)
assert.deepEqual(filterArchiveCards(fixture, { query: 'first' }), [fixture[0]])
assert.deepEqual(filterArchiveCards(fixture, { assetState: 'visible_icon' }), [])
assert.deepEqual(filterArchiveCards(fixture, { relationState: 'unrelated' }), [fixture[0]])
assert.deepEqual(filterArchiveCards(fixture, { relationState: 'event_card', eventRelations: { one: [] } }), [fixture[0]], 'existing empty relation array remains a present relation')
assert.equal(JSON.stringify(fixture), before)
assert.equal(filterArchiveCards(fixture)[0], fixture[0], 'filter must retain source object identity and order')
const cardHeading = app.match(/const currentCardCharacterName = computed\(\(\) => \{[^]*?\n\}\)/)?.[0] || ''
assert.ok(cardHeading.includes('idolSourceName(id)'), 'card archive heading keeps the master-data idol name')
assert.equal(cardHeading.includes('idolDisplayName(id)'), false, 'card archive heading does not localize the idol name independently of its switcher')
console.log(`Card filters: ${cards.length} normalized cards, ${cases} combinations, hash ${hash}; missing data, search, relation presence and input preservation passed`)
