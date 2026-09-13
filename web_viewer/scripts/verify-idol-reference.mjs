import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { buildIdolReference } from '../src/presentation/IdolReferencePresentation.js'
import { buildUnitCatalog } from '../src/data/unitPage.js'

function readJson(path) { return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) }

const dictionary = readJson('../public/data/masterdata/idol_unit_dictionary.json')
const manifest = readJson('../public/data/archive_manifest.json')
const cards = readJson('../public/data/masterdata/card_index.json').cards
assert.ok(cards.length > 0, 'card corpus is empty')

for (const card of cards) {
  const owner = buildIdolReference(card.character_id, dictionary, manifest, `card:${card.resource_id}`)
  assert.equal(owner.actionable, true, `unresolved card owner: ${card.resource_id}`)
  assert.equal(owner.displayName, dictionary.by_idol_code[card.character_id]?.display_name)
  assert.equal(owner.idolCode, card.character_id)
  assert.deepEqual(owner.imageCandidates.map(candidate => candidate.url), [
    `/assets/idols/icons/image_chara_icon_${card.character_id}.png`,
  ])
  assert.ok(existsSync(new URL(`../public${owner.imageCandidates[0].url}`, import.meta.url)),
    `missing owner icon: ${card.character_id}`)
}

const unitMembers = buildUnitCatalog(dictionary, { manifest }).flatMap(entry => entry.members)
assert.equal(unitMembers.length, Object.keys(manifest.unit_membership_by_idol).length,
  'unit member references retain the membership evidence count')
for (const member of unitMembers) {
  const reference = buildIdolReference(member.idol_code, dictionary, manifest, 'unit-member')
  assert.equal(reference.idolCode, member.idol_code)
  assert.equal(reference.displayName, dictionary.by_idol_code[member.idol_code]?.display_name)
  assert.equal(reference.actionable, true, `unresolved unit member: ${member.idol_code}`)
}

const touma = buildIdolReference('001tom', dictionary, manifest, 'card:001tom_n01')
assert.equal(touma.displayName, '天ヶ瀬 冬馬')
assert.equal(touma.unitName, 'Jupiter')
for (const unknown of ['999xxx', '01jup', '', '../001tom']) {
  const reference = buildIdolReference(unknown, dictionary, manifest, 'missing-card')
  assert.equal(reference.actionable, false)
  assert.equal(reference.imageCandidates.length, 0)
  assert.equal(reference.displayName, '姓名待确认')
}

console.log(`Idol references: ${cards.length} real card owners and ${unitMembers.length} unit members resolved; unknown identities remain inert`)
