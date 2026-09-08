import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { buildIdolProfile, buildIdolStats, eventsForIdol, songsForIdol } from '../src/data/idolPage.js'
import { buildCardMap, cardsForCharacter } from '../src/data/archiveSelectors.js'

const read = path => JSON.parse(readFileSync(new URL(`../public/data/${path}`, import.meta.url), 'utf8'))
const data = {
  dictionary: read('masterdata/idol_unit_dictionary.json'), manifest: read('archive_manifest.json'),
  cardIndex: read('masterdata/card_index.json'), episodes: read('masterdata/idol_episode_index.json'),
  mobile: read('masterdata/mobile_archive_index.json'), songs: read('song_catalog.json'),
}
const before = JSON.stringify(data)
data.cardMap = buildCardMap(data.cardIndex)
const baseline = process.argv[2] ? new Function('id', 'data', 'cardsForCharacter', `
  const computed=fn=>({value:fn()}), currentCharacterId={value:id};
  const idolUnitData={value:data.dictionary}, archiveManifestData={value:data.manifest}, cardIndexData={value:data.cardIndex},
    cardMap={value:data.cardMap}, idolEpisodeData={value:data.episodes}, mobileArchiveData={value:data.mobile}, songCatalogData={value:data.songs};
  ${readFileSync(process.argv[2], 'utf8')}
  return [currentIdolProfile.value,currentIdolStats.value,currentIdolEvents.value,currentIdolSongs.value];
`) : null
const digest = createHash('sha256')
const ids = [...Object.keys(data.dictionary.by_idol_code), 'missing-id']
for (const id of ids) {
  const result = [buildIdolProfile(id, data.dictionary, data.manifest), buildIdolStats(id, data), eventsForIdol(id, data.manifest), songsForIdol(id, data.songs)]
  if (baseline) assert.deepEqual(result, baseline(id, data, cardsForCharacter))
  digest.update(JSON.stringify([id, result]))
}
const hash = digest.digest('hex')
if (!baseline) assert.equal(hash, '0a961f02253cf9f55c142bb3912f0314cc6f5109c64fed9772f47e8b10974642')
delete data.cardMap
assert.equal(JSON.stringify(data), before)
assert.equal(buildIdolProfile('missing'), null)
assert.deepEqual(buildIdolStats('missing'), { cards: 0, stories: 0, chats: 0, phones: 0 })
assert.deepEqual(eventsForIdol('missing'), [])
assert.deepEqual(songsForIdol('missing'), [])
const profile = { unit_name: 'fallback', unit_id: 7 }
assert.equal(buildIdolProfile('id', { by_idol_code: { id: profile } }, { unit_membership_by_idol: { id: { unit_name: 'override' } } }).unit_name, 'override')
assert.equal(profile.unit_name, 'fallback')
const mobile = { scenarios: [{ id: 'talk', kind: 'idol_talk' }, { id: 'phone', kind: 'idol_phone' }], by_idol_code: { id: ['missing', 'talk', 'phone'] } }
assert.deepEqual(buildIdolStats('id', { mobile }), { cards: 0, stories: 0, chats: 1, phones: 1 })
const song = { song_id: 1, performance_mapping: { performer_idol_codes: ['id'], performer_basis: 'table46_explicit' } }
assert.equal(songsForIdol('id', { songs: { one: song } })[0].song, song)
assert.equal(songsForIdol('id', { songs: { one: song } })[0].evidenceLabel, '表 46 明确演唱／参演')
console.log(`Idol page: ${ids.length} identities including missing ID; hash ${hash}; profile precedence, missing communication, evidence labels and input preservation passed`)
