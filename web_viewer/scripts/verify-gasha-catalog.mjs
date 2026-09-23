import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { buildGashaCatalog, buildGashaCategoryOptions, filterGashaCatalog, resolveGashaRelatedCards } from '../src/data/gashaCatalog.js'

const index = JSON.parse(readFileSync(new URL('../public/data/masterdata/gasha_index.json', import.meta.url), 'utf8'))
const before = JSON.stringify(index)
const baseline = process.argv[2] ? new Function('index', 'query', 'category', 'id', `
  const gashaIndexData={value:index}, filterQuery={value:query}, currentGashaCategory={value:category}, currentGashaId={value:id};
  const computed=fn=>({value:fn()}), idolEntitySearchText=id=>String(id || '');
  ${readFileSync(process.argv[2], 'utf8')}
  return {catalog:gashaCatalog.value, options:gashaCategoryOptions.value, filtered:filteredGashas.value, current:currentGasha.value};
`) : null
const catalog = buildGashaCatalog(index)
const options = buildGashaCategoryOptions(index, catalog)
const digest = createHash('sha256')
digest.update(JSON.stringify([catalog, options]))
let cases = 0
for (const category of options.map(option => option.value)) {
  for (const query of ['', '  growing  ', '001', 'SSR', 'missing-fixture-title']) {
    const filtered = filterGashaCatalog(catalog, { query, category, idolSearchText: id => String(id || '') })
    if (baseline) {
      const old = baseline(index, query, category, '')
      assert.deepEqual(catalog, old.catalog)
      assert.deepEqual(options, old.options)
      assert.deepEqual(filtered, old.filtered)
    }
    digest.update(JSON.stringify([category, query, filtered]))
    cases++
  }
}
for (const [id, entry] of Object.entries(index.by_id || {})) {
  const current = resolveGashaRelatedCards(entry, index)
  if (baseline) assert.deepEqual(current, baseline(index, '', 'all', id).current)
  digest.update(JSON.stringify([id, current]))
}
const hash = digest.digest('hex')
if (!baseline) assert.equal(hash, '37d105d2ecd31c57a9a539a96419e5d293e7f380bd057fe71dddb2a41f2284ee')
assert.equal(JSON.stringify(index), before)
assert.deepEqual(buildGashaCatalog(null), [])
assert.equal(resolveGashaRelatedCards(null, null), null)
const card = { card_resource_id: 'card', character_id: 'idol', card_title: 'Sample' }
const source = { by_code: { origin: { derived_pickup_cards: [card] } } }
const reprint = { related_pickup_count: 1, related_pickup_source: 'reprint', reprint_of: 'origin', related_pickup_card_ids: ['card'] }
assert.equal(resolveGashaRelatedCards(reprint, source).related_pickup_cards[0], card)
assert.deepEqual(resolveGashaRelatedCards(reprint, null).related_pickup_cards, [])
const related = resolveGashaRelatedCards(reprint, source)
assert.deepEqual(filterGashaCatalog([related], { query: ' translated ', idolSearchText: () => 'translated name' }), [related])
assert.deepEqual(filterGashaCatalog([related], { query: 'unmatched' }), [])
console.log(`Gasha catalog: ${catalog.length} primary entries, ${cases} filters and ${Object.keys(index.by_id || {}).length} details; hash ${hash}; reprint, missing source, localized search and input isolation passed`)
