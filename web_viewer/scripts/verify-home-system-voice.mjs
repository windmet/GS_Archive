// Home stand voices: the idol's general pool joins the card pool, and the native decider keeps
// SystemScenarioDecider's term, weight, awakening, override and recent-four rules.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { archiveHomeStateStats, buildArchiveHomeState } from '../src/data/archiveHomeState.js'
import { createHomeVoiceDecider, homeVoiceClock, homeVoiceConditionKind, homeVoiceConditionLabel,
  homeVoiceInTerm, homeVoiceMonthOpen, homeVoicePool } from '../src/data/homeVoiceDecider.js'
import { validateArchivePayload } from '../src/data/archiveDataContracts.js'
import { normalizeArchiveHomePreferences } from '../src/data/archiveHomePreferences.js'

const readJson = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'))
const index = readJson('../public/data/masterdata/home_system_voice_index.json')
const idolUnit = readJson('../public/data/masterdata/idol_unit_dictionary.json')
const cardIndex = readJson('../public/data/masterdata/card_index.json')
const manifest = readJson('../public/data/archive_manifest.json')
const costumes = readJson('../public/data/masterdata/costume_dictionary.json')
const localMedia = fs.existsSync(new URL('../public/assets/voice/3_1_048_05.m4a', import.meta.url))

// Projection: ScriptName resolves the script, ScriptLabel its jump point; nothing is left over.
validateArchivePayload('homeSystemVoice', index)
assert.deepEqual([index.meta.idol_count, index.meta.idol_home_stand_count, index.meta.unresolved_count], [49, 1029, 0])
assert.deepEqual([index.meta.month_conditioned_count, index.meta.time_conditioned_count, index.meta.compiled_file_count], [391, 420, 49])
assert.deepEqual(index.meta.idol_type_counts, { 1: 1029, 4: 49, 6: 343 })
assert.deepEqual(index.meta.card_type_counts, { 1: 2356, 2: 208 })
for (const idol of index.idols) {
  assert.equal(idol.scenarios.length, 21, idol.idol_code)
  for (const row of idol.scenarios) {
    assert.equal(row.type, 1)
    assert.ok(row.param1 > 0, `${row.script_label} has a draw weight`)
    assert.equal(row.voice, `${row.script_label}.m4a`)
    assert.equal(row.step_id, row.jump_step_id)
    assert.ok(row.compiled_file.endsWith(`_${row.script_name}.json`))
    if (localMedia) {
      const compiled = readJson(`../public/data/compiled/${row.compiled_file}`)
      assert.equal(compiled.jump_points[row.script_label], row.step_id)
      assert.ok(fs.statSync(new URL(`../public/assets/voice/${row.voice}`, import.meta.url)).size > 0, row.voice)
    }
  }
}
const momo = index.idols.find(idol => idol.idol_code === '048mom').scenarios
const label = id => momo.find(row => row.script_label === id)
assert.deepEqual([label('3_1_048_05').open_time, label('3_1_048_05').close_time], ['06:00:00', '11:00:00'])
assert.deepEqual([label('3_1_048_19').open_month, label('3_1_048_19').close_month], [12, 2])
assert.equal(label('3_1_048_05').compiled_file, '3_x_048mom_3_1_048.json')

// Home state: 21 general voices lead each idol; every card voice keeps its HomeStand condition.
const idols = buildArchiveHomeState(idolUnit, cardIndex, manifest, costumes, index)
const stats = archiveHomeStateStats(idols)
assert.deepEqual([stats.idols, stats.cues, stats.idolCues, stats.cardCues, stats.playable], [49, 3385, 1029, 2356, 3385])
const legacy = buildArchiveHomeState(idolUnit, cardIndex, manifest, costumes)
for (const idol of idols) {
  const general = idol.cues.filter(cue => cue.source === 'idol')
  assert.equal(general.length, 21, idol.id)
  assert.ok(idol.cues.slice(0, 21).every(cue => cue.source === 'idol'), 'the general pool leads')
  const cards = idol.cues.filter(cue => cue.source === 'card')
  assert.ok(cards.every(cue => cue.condition && cue.condition.weight > 0), `${idol.id} card voices keep their HomeStand rows`)
  // The card voices are exactly the previous home cues, in the same order.
  assert.deepEqual(cards.map(cue => cue.id), legacy.find(row => row.id === idol.id).cues.map(cue => cue.id))
  assert.equal(new Set(idol.cues.map(cue => cue.cue)).size, idol.cues.length, `${idol.id} cue identities stay unique`)
}
const momoHome = idols.find(idol => idol.id === '048mom')
const morning = momoHome.cues.find(cue => cue.cue === '3_1_048_05')
assert.equal(morning.id, 'idol:3_1_048_05')
assert.equal(morning.cardId, '')
assert.equal(morning.previewStep.dialogue.voice, '3_1_048_05.m4a')
assert.equal(homeVoiceConditionLabel(morning.condition), '06:00–11:00')
assert.equal(homeVoiceConditionLabel(momoHome.cues.find(cue => cue.cue === '3_1_048_13').condition), '3–5月 · 10:00–17:00')
assert.equal(homeVoiceConditionKind(momoHome.cues.find(cue => cue.cue === '3_1_048_19').condition), 'season')
assert.equal(cardIndex.cards.flatMap(card => card.home_voice_cues || []).length, 2564, 'raw card rows still include HomeCard duplicates')
assert.equal(idols.flatMap(idol => idol.cues).filter(cue => cue.condition?.awakenedOnly).length, 826)

// Term: months may wrap the year; time is [open, close) on today's date (IsInTerm).
const at = (month, time) => ({ month, second: time.split(':').reduce((sum, part) => sum * 60 + Number(part), 0) })
const condition = (openMonth, closeMonth, openTime = '00:00:00', closeTime = '00:00:00') => ({ openMonth, closeMonth, openTime, closeTime })
assert.ok(homeVoiceMonthOpen(condition(12, 2), 1) && homeVoiceMonthOpen(condition(12, 2), 12) && !homeVoiceMonthOpen(condition(12, 2), 3))
assert.ok(homeVoiceMonthOpen(condition(1, 12), 7) && !homeVoiceMonthOpen(condition(3, 4), 5))
assert.ok(homeVoiceInTerm(condition(1, 12), at(5, '00:00:00')) && homeVoiceInTerm(condition(1, 12), at(5, '23:59:59')), '00:00-00:00 is all day')
assert.ok(homeVoiceInTerm(condition(1, 12, '06:00:00', '11:00:00'), at(5, '06:00:00')))
assert.ok(!homeVoiceInTerm(condition(1, 12, '06:00:00', '11:00:00'), at(5, '11:00:00')), 'the close is exclusive')
assert.ok(homeVoiceInTerm(condition(1, 12, '19:00:00', '02:00:00'), at(5, '23:30:00')))
assert.ok(!homeVoiceInTerm(condition(1, 12, '19:00:00', '02:00:00'), at(5, '01:00:00')),
  'a window past midnight is anchored to today: its early-morning tail never matches')
assert.deepEqual(homeVoiceClock(new Date('2026-01-31T15:30:00Z')), { month: 2, second: 30 * 60 }, 'the server clock is Japan time')

// Pool: unawakened cards drop Param2 rows; a card override removes that idol row; weight 0 never plays.
const cue = (id, extra = {}) => ({ id, condition: { id: extra.rowId || 0, ...condition(1, 12), weight: 100, awakenedOnly: false, overrideId: 0, ...extra } })
const idolPool = [cue('idol:a', { rowId: 11 }), cue('idol:b', { rowId: 12 }), cue('idol:zero', { rowId: 13, weight: 0 })]
const cardPool = [cue('card:x'), cue('card:awake', { awakenedOnly: true }), cue('card:override', { overrideId: 12 })]
assert.deepEqual(homeVoicePool(idolPool, cardPool).map(row => row.id), ['card:x', 'card:awake', 'card:override', 'idol:a'])
assert.deepEqual(homeVoicePool(idolPool, cardPool, { awakened: false }).map(row => row.id), ['card:x', 'card:override', 'idol:a'])

// Draw: cumulative Param1 weights; the recent four are skipped only while more candidates remain.
const sequence = values => () => values.shift()
const weighted = [cue('w1', { weight: 450 }), cue('w2', { weight: 550 })]
assert.equal(createHomeVoiceDecider({ random: sequence([0.44]) }).pick(weighted, at(5, '12:00:00')).id, 'w1')
assert.equal(createHomeVoiceDecider({ random: sequence([0.46]) }).pick(weighted, at(5, '12:00:00')).id, 'w2')
const five = ['a', 'b', 'c', 'd', 'e'].map(id => cue(id))
const decider = createHomeVoiceDecider({ random: () => 0 })
assert.deepEqual(Array.from({ length: 6 }, () => decider.decide(five, at(5, '12:00:00')).id), ['a', 'b', 'c', 'd', 'e', 'a'])
assert.deepEqual(decider.recent, ['c', 'd', 'e', 'a'])
const small = createHomeVoiceDecider({ random: () => 0 })
assert.deepEqual(Array.from({ length: 3 }, () => small.decide(five.slice(0, 2), at(5, '12:00:00')).id), ['a', 'b', 'a'],
  'with no more candidates than recent entries nothing is excluded')
const peek = createHomeVoiceDecider({ random: () => 0 })
peek.pick(five, at(5, '12:00:00'))
assert.deepEqual(peek.recent, [], 'a prepared voice is remembered only once a tap shows it')
assert.equal(createHomeVoiceDecider().pick([cue('night', condition(1, 12, '19:00:00', '00:00:00'))], at(5, '08:00:00')), null)

// Momo at 07:00 in May: card voices plus the all-day, morning and spring rows, never winter or night.
const morningPool = homeVoicePool(momoHome.cues.filter(row => row.source === 'idol'), [])
  .filter(row => homeVoiceInTerm(row.condition, at(5, '07:00:00'))).map(row => row.cue)
assert.ok(morningPool.includes('3_1_048_05') && !morningPool.includes('3_1_048_12') && !morningPool.includes('3_1_048_19'))

// The native draw is a pending item: taps step or shuffle the whole general + card list.
assert.equal(normalizeArchiveHomePreferences({}).dialogueOrder, 'sequential')
assert.equal(normalizeArchiveHomePreferences({ dialogueOrder: 'native' }).dialogueOrder, 'sequential', 'an earlier native choice falls back')
assert.doesNotMatch(fs.readFileSync(new URL('../src/components/archive/ArchiveImmersiveHome.vue', import.meta.url), 'utf8'),
  /createHomeVoiceDecider|dialogueOrder === 'native'/, 'the home does not run the native draw yet')
console.log(`Home system voices verified: ${stats.idolCues} general + ${stats.cardCues} card voices for ${stats.idols} idols${localMedia ? ', local scripts and audio checked' : ''}.`)
