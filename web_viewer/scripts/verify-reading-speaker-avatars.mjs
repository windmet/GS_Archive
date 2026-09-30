import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { READING_NPC_ICON_CODES, readingSpeakerAvatarEntity } from '../src/presentation/ReadingSpeakerAvatar.js'
import { readingAvatarEntity } from '../shared/reading/ReadingDocument.js'

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url)))
assert.equal(READING_NPC_ICON_CODES.length, 25)
for (const code of READING_NPC_ICON_CODES) {
  assert.ok(existsSync(new URL(`../public/assets/idols/icons/image_chara_icon_${code}.png`, import.meta.url)))
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
console.log('Reader speaker icons verified: 25 audited NPC assets, real Ken/President/Nyankee rows, unknown and generic exclusions, idol visual policy')
