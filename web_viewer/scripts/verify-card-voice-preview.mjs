import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildCardVoicePreviewScenario, findCardVoiceCue } from '../src/data/cardVoicePreview.js'
import { mergeCardDetail } from '../src/data/archiveSelectors.js'

const read = name => JSON.parse(readFileSync(new URL(`../public/data/masterdata/${name}.json`, import.meta.url), 'utf8'))
const index = read('card_index'), details = read('card_detail_index')
let sourceSteps = 0, fallbackSteps = 0
for (const card of index.cards) {
  const operational = mergeCardDetail(card, details)?.operational_voice_cues || []
  const cues = [...(card.home_voice_cues || []), ...operational,
    ...Object.values(card.card_text_voices || {}), ...(card.voice_candidates?.unmapped_card_only || [])]
  for (const cue of cues) {
    const id = typeof cue === 'string' ? cue : cue.cue
    const resolved = findCardVoiceCue(card, id, operational)
    assert.ok(resolved, `${card.resource_id}: missing ${id}`)
    const before = JSON.stringify(cue)
    const result = buildCardVoicePreviewScenario(card, cue, id => `speaker:${id}`)
    const home = card.home_voice_cues?.find(item => item.cue === id)
    if (home?.preview?.preview_step) {
      sourceSteps++
      assert.ok(result, `${id}: source-backed home preview must remain available`)
      assert.equal(result.total_steps, 1)
      assert.deepEqual(result.steps[0], { ...home.preview.preview_step, step_id: 1 })
      assert.equal(result.source_scenario_id, home.preview.scenario_id)
      assert.equal(result.source_compiled_file, home.preview.compiled_file)
      assert.notEqual(result.steps[0], home.preview.preview_step)
      if (result.steps[0].state) result.steps[0].state.bg = 'mutation-isolation-check'
    } else {
      fallbackSteps++
      assert.equal(result, null, `${id}: audio-only evidence must not fabricate ADV/model/lip`)
    }
    assert.equal(JSON.stringify(cue), before, 'adapter mutated source evidence')
  }
  assert.equal(findCardVoiceCue(card, 'not-a-card-cue', operational), undefined)
}
assert.ok(sourceSteps > 0 && fallbackSteps > 0)
// Neither arbitrary cues nor a forged operational preview can create a scene.
const operationalPreview = { cue: 'cue', preview: { preview_step: { dialogue: { text: 'forged', voice: 'cue.m4a' } } } }
assert.equal(buildCardVoicePreviewScenario({ resource_id: '001tom_card' }, operationalPreview), null)
assert.equal(buildCardVoicePreviewScenario({ resource_id: '001tom_card' }, 'cue'), null)
const mismatched = { home_voice_cues: [{ cue: 'cue', preview: { preview_step: { dialogue: { text: 'line', voice: 'other.m4a' } } } }] }
assert.equal(buildCardVoicePreviewScenario(mismatched, 'cue'), null)
// Prefer home evidence over operational/text/unmapped candidates with the same ID.
const home = { cue: 'same', text: 'home' }, operational = { cue: 'same', text: 'operational' }
assert.equal(findCardVoiceCue({ home_voice_cues: [home] }, 'same', [operational]), home)
console.log(`Card voice preview: ${index.cards.length} cards, ${sourceSteps} source steps, ${fallbackSteps} audio-only cues; ownership and source isolation passed`)
