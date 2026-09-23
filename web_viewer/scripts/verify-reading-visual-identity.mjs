import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { normalizeScenario } from '../shared/story/ScenarioNormalizer.js'
import { normalizeLegacyDialogue } from '../src/localization/story/LegacyDialogueAdapter.js'
import { projectReadingIdentity, readingVisualAvatarEntity } from '../shared/reading/ReadingVisualIdentity.js'
import { readingPresentationSpeaker } from '../shared/reading/ReadingDocument.js'

const read = async file => JSON.parse(await fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8'))
const dictionary = await read('public/data/masterdata/idol_unit_dictionary.json')
const knownIdolIds = new Set(dictionary.idols.map(idol => idol.idol_code))
const speaker = { kind: 'unknown', entityType: 'idol', entityId: '047shu', sourceName: '？？？' }
const step = { step_id: 12, type: 'adv', chara_id: '047shu', snapshot_format: 'story-snapshot-v2',
  entry_snapshot: { phone_mode: false, talk_mode: false,
    spines: [{ id: '001tom', model: '001tom_005_00', visible: true },
      { id: '047shu', model: '047shu_005_00', visible: true }] } }
const project = (source = step, label = speaker, rowKind = 'dialogue') => projectReadingIdentity({
  step: source, rowKind, speaker: label, knownIdolIds,
})
const avatar = projection => readingVisualAvatarEntity({ ...projection, kind: 'dialogue', speaker, anchor: { step_id: 12 } })
const before = JSON.stringify(step)
const shown = project()
assert.equal(avatar(shown), '047shu', 'match current actor rather than the first spine')
assert.deepEqual(project(), shown)
assert.equal(JSON.stringify(step), before)
assert.equal(readingPresentationSpeaker({ speaker }).sourceName, '？？？')
assert.equal(readingPresentationSpeaker({ speaker }).entityId, null, 'localization must not reveal the name')
assert.equal(project(step, { ...speaker, kind: 'named' }).visual.presence, 'visible')
assert.equal(project(step, { ...speaker, entityId: '001tom' }).visual.presence, 'unknown')
const optionalParts = structuredClone(step)
optionalParts.entry_snapshot.spines[1].parts_visible = false
assert.equal(avatar(project(optionalParts)), '047shu', 'optional costume parts do not hide the actor')
for (const kind of ['title', 'synopsis', 'narration', 'caption', 'choice', 'choice_detail']) {
  assert.equal(project(step, speaker, kind).visual.presence, 'not-applicable')
}
assert.equal(project(step, { ...speaker, kind: 'producer' }).visual.presence, 'not-applicable')
for (const actor of [null, 'group', '047shu_001', '999abc']) {
  assert.equal(avatar(project({ ...step, chara_id: actor })), null, 'no model/name/alias guessing')
}
for (const [label, change, expected] of [
  ['missing entry', s => { delete s.entry_snapshot }, 'unknown'],
  ['missing spines', s => { delete s.entry_snapshot.spines }, 'unknown'],
  ['offstage', s => { s.entry_snapshot.spines = [] }, 'offstage'],
  ['hidden', s => { s.entry_snapshot.spines[1].visible = false }, 'hidden'],
  ['missing visible', s => { delete s.entry_snapshot.spines[1].visible }, 'unknown'],
  ['truthy visible', s => { s.entry_snapshot.spines[1].visible = 1 }, 'unknown'],
  ['silhouette', s => { s.entry_snapshot.spines[1].idol_color = '#000000' }, 'silhouette'],
  ['model conflict', s => { s.entry_snapshot.spines[1].model = '230sub_001_00' }, 'unknown'],
  ['fade', s => { s.entry_snapshot.spines[1].fade = { type: 'in', delay: 2 } }, 'unknown'],
  ['zero alpha', s => { s.entry_snapshot.spines[1].alpha = 0 }, 'hidden'],
  ['duplicate', s => { s.entry_snapshot.spines.push(s.entry_snapshot.spines[1]) }, 'unknown'],
  ['phone', s => { s.entry_snapshot.phone_mode = true }, 'unknown'],
  ['chat', s => { s.entry_snapshot.talk_mode = true }, 'unknown'],
  ['call', s => { s.type = 'call' }, 'unknown'],
]) {
  const changed = structuredClone(step)
  change(changed)
  const projection = project(changed)
  assert.equal(projection.visual.presence, expected, label)
  assert.equal(avatar(projection), null, label)
}
const future = structuredClone(step)
future.settled_snapshot = structuredClone(step.entry_snapshot)
future.entry_snapshot.spines = []
assert.equal(project(future).visual.presence, 'offstage', 'never use future reveal')
assert.ok(project(future).diagnostics.includes('entry-settled-actor-difference'))
const currentlyVisible = structuredClone(step)
currentlyVisible.settled_snapshot = { spines: [] }
assert.equal(avatar(project(currentlyVisible)), '047shu', 'future exit does not erase current appearance')
assert.equal(readingVisualAvatarEntity({ ...shown, kind: 'dialogue', speaker, anchor: { step_id: 13 } }), null)
const legacy = normalizeScenario({ steps: [{ step_id: 12, type: 'adv', chara_id: '047shu', state: step.entry_snapshot }] }).steps[0]
assert.equal(avatar(project(legacy)), '047shu')
assert.ok(project(legacy).diagnostics.includes('compatibility-stage-evidence'))
console.log('Reading identity matrix passed: text secrecy, actor matching, medium, concealment, ambiguity and entry-only evidence')

if (process.argv.includes('--local-sources')) {
  const manifest = await read('public/data/reading/manifest.json')
  const counts = {}, reasons = {}
  let rows = 0, shu12 = false
  for (const entry of manifest.entries) {
    const doc = await read(`public/data/reading/${entry.file}`)
    const bytes = await fs.readFile(new URL(`../public/data/compiled/${entry.source_file}`, import.meta.url))
    assert.equal(`sha256:${createHash('sha256').update(bytes).digest('hex')}`, doc.source.sha256)
    const scenario = normalizeScenario(JSON.parse(bytes))
    for (const row of doc.rows) {
      const current = scenario.steps[row.anchor.step_index]
      assert.equal(current.step_id, row.anchor.step_id)
      const projection = project(current, row.speaker, row.kind)
      rows++
      counts[projection.visual.presence] = (counts[projection.visual.presence] || 0) + 1
      reasons[projection.visual.reason] = (reasons[projection.visual.reason] || 0) + 1
      if (entry.document_id === '1_4_001_00_a' && current.step_id === 12 && row.kind === 'dialogue') {
        assert.equal(current.chara_id, '047shu')
        assert.equal(normalizeLegacyDialogue(current.dialogue).speaker.kind, 'unknown')
        assert.equal(readingVisualAvatarEntity({ ...row, ...projection }), '047shu')
        assert.equal(readingPresentationSpeaker(row).sourceName, '？？？')
        shu12 = true
      }
    }
  }
  assert.ok(shu12, 'verify the actual user-reported source step')
  console.log(JSON.stringify({ documents: manifest.entries.length, rows, counts, reasons }, null, 2))
}
