import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { READING_NPC_ICON_CODES, readingSpeakerAvatarEntity } from '../src/presentation/ReadingSpeakerAvatar.js'
import { readingAvatarEntity } from '../shared/reading/ReadingDocument.js'

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url)))
const localMedia = process.argv.includes('--local-media')
const speakers = read('public/data/masterdata/speaker_dictionary.json').speakers
assert.equal(READING_NPC_ICON_CODES.length, 25)
for (const code of READING_NPC_ICON_CODES) {
  // 241sub is evidenced by the published Nyankee dialogue below. The other
  // identities are independently bound to the masterdata NPC dictionary.
  if (code !== '241sub') assert.equal(speakers[code]?.npc_code, code)
  if (localMedia) {
    const png = readFileSync(new URL(`../public/assets/idols/icons/image_chara_icon_${code}.png`, import.meta.url))
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${code}: PNG signature`)
    assert.equal(png.readUInt32BE(16), 148, `${code}: published width`)
    assert.equal(png.readUInt32BE(20), 148, `${code}: published height`)
  }
  const row = {kind:'dialogue',speaker:{kind:'npc',entityType:'npc',entityId:code,sourceName:'Named speaker'}}
  assert.equal(readingSpeakerAvatarEntity(row), code)
  for (const kind of ['unknown','none','producer']) assert.equal(readingSpeakerAvatarEntity({...row,speaker:{...row.speaker,kind}}), null)
  for (const kind of ['caption','choice','choice_detail','synopsis','narration']) assert.equal(readingSpeakerAvatarEntity({...row,kind}), null)
  assert.equal(readingSpeakerAvatarEntity({...row,speaker:{...row.speaker,sourceName:'？？？'}}), null)
}
for (const code of ['100grp','mob','group','999sub','229sub']) {
  assert.equal(readingSpeakerAvatarEntity({kind:'dialogue',speaker:{kind:'named',entityId:code,sourceName:'Known name'}}), null)
}
const opening = read('public/data/reading/1_4_001_01_a.json')
const before = JSON.stringify(opening)
for (const code of ['101ken','102sha']) {
  const row = opening.rows.find(row => row.speaker.entityId === code)
  assert.ok(row)
  assert.equal(readingAvatarEntity(row), null, 'speaker icon does not rewrite visual evidence')
  assert.equal(readingSpeakerAvatarEntity(row), code, 'published legacy NPC identity resolves its icon')
}
const nyankee = read('public/data/reading/1_5_025suz_1_5_025_04.json').rows.find(row => row.speaker.entityId === '241sub')
assert.equal(readingSpeakerAvatarEntity(nyankee), '241sub')
const prologue = read('public/data/reading/1_4_001_00_a.json')
for (const row of prologue.rows.filter(row => row.speaker.entityId?.startsWith('047'))) {
  assert.equal(readingSpeakerAvatarEntity(row), readingAvatarEntity(row), 'idol entry-stage and secrecy policy is unchanged')
}
const idol = opening.rows.find(row => readingAvatarEntity(row) === '001tom')
assert.ok(idol)
assert.equal(readingSpeakerAvatarEntity({...idol,visual:{...idol.visual,presence:'hidden'}}), null)
assert.equal(readingSpeakerAvatarEntity({...idol,visual:{...idol.visual,presence:'offstage'}}), null)
assert.equal(JSON.stringify(opening), before, 'canonical text, hash, actor and anchors are immutable')
for (const id of ['1_4_001_03_d','1_4_001_03_e','1_4_001_03_f','1_4_001_03_g','1_4_001_03_h','1_4_001_03_i','1_4_001_03_j']) {
  const doc = read(`public/data/reading/${id}.json`)
  const candidates = doc.rows.filter(row => row.kind === 'dialogue' && row.visual?.reason === 'medium-policy-unavailable')
  assert.ok(candidates.length)
  for (const row of candidates) {
    assert.equal(readingSpeakerAvatarEntity(row), row.performance.entityId, 'Call/Chat and post-call ADV retain exact named source portraits')
    assert.equal(readingSpeakerAvatarEntity({...row,speaker:{...row.speaker,kind:'unknown'}}), null)
    assert.equal(readingSpeakerAvatarEntity({...row,speaker:{...row.speaker,sourceName:'？？？'}}), null)
    assert.equal(readingSpeakerAvatarEntity({...row,speaker:{...row.speaker,sourceName:'別人'}}), null)
    assert.equal(readingSpeakerAvatarEntity({...row,visual:{...row.visual,reason:'speaker-performance-conflict'}}), null)
  }
}
console.log('Reader speaker identity policy verified: 25 audited NPC codes, masterdata and real Ken/President/Nyankee rows, unknown and generic exclusions, idol visual policy')
console.log(localMedia ? 'Local media verified: 25 published PNG icons, 148x148 each' : 'Source-only gate: local icon bytes require --local-media; no media acceptance claimed')
