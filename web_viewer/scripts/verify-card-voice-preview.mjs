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
    assert.equal(result.total_steps, 1)
    assert.equal(result.steps.length, 1)
    assert.equal(result.steps[0].step_id, 1)
    assert.equal(result.scenario_id, `card_voice_preview_${card.resource_id}_${id}`)
    if (cue?.preview?.preview_step) {
      sourceSteps++
      assert.deepEqual(result.steps[0], { ...cue.preview.preview_step, step_id: 1 })
      assert.equal(result.source_scenario_id, cue.preview.scenario_id)
      assert.equal(result.source_compiled_file, cue.preview.compiled_file)
      assert.notEqual(result.steps[0], cue.preview.preview_step)
      if (result.steps[0].state) result.steps[0].state.bg = 'mutation-isolation-check'
    } else {
      fallbackSteps++
      const character = card.character_id || card.resource_id?.slice(0, 6) || ''
      assert.equal(result.steps[0].dialogue.speaker, `speaker:${character}`)
      assert.equal(result.steps[0].dialogue.voice, `${id}.m4a`)
      assert.equal(result.steps[0].dialogue.lip.path,
        `adxlip/${character}/${card.voice_base || id.split('_').slice(0, 5).join('_')}/${id}.json`)
      assert.equal(result.steps[0].state.spines[0].id, character)
    }
    assert.equal(JSON.stringify(cue), before, 'adapter mutated source evidence')
  }
  assert.equal(findCardVoiceCue(card, 'not-a-card-cue', operational), undefined)
}
assert.ok(sourceSteps > 0 && fallbackSteps > 0)
// Speaker ownership follows the supplied card, regardless of another selected card.
const cardA = { resource_id: '001tom_card', character_id: '001tom' }
const cardB = { resource_id: '002kao_card', character_id: '002kao' }
const names = id => `display:${id}`
assert.equal(buildCardVoicePreviewScenario(cardB, 'cue', names).steps[0].dialogue.speaker, 'display:002kao')
assert.equal(buildCardVoicePreviewScenario(cardA, 'cue', names).steps[0].dialogue.speaker, 'display:001tom')
// Prefer home evidence over operational/text/unmapped candidates with the same ID.
const home = { cue: 'same', text: 'home' }, operational = { cue: 'same', text: 'operational' }
assert.equal(findCardVoiceCue({ home_voice_cues: [home] }, 'same', [operational]), home)
console.log(`Card voice preview: ${index.cards.length} cards, ${sourceSteps} source steps, ${fallbackSteps} fallbacks; ownership and source isolation passed`)
