import assert from 'node:assert/strict'
import fs from 'node:fs'

// Old embedded card previews retained one-shot neck commands from earlier lines.
// Compare against the current compiled source, including valid immediate commands.
const path = new URL('../public/data/masterdata/card_index.json', import.meta.url)
const index = JSON.parse(fs.readFileSync(path, 'utf8'))
let checked = 0
for (const card of process.argv.includes('--source-only') ? [] : index.cards) {
  for (const cue of card.home_voice_cues || []) {
    const preview = cue.preview
    if (!preview?.preview_step) continue
    const source = JSON.parse(fs.readFileSync(new URL(`../public/data/compiled/${preview.compiled_file}`, import.meta.url), 'utf8'))
    const step = source.steps.find(step => step.dialogue?.voice === preview.voice)
    assert.ok(step, `${card.resource_id}: ${cue.cue}: source missing`)
    for (const spines of [preview.spines, preview.preview_step.state.spines]) {
      for (const spine of spines || []) {
        const original = step.state.spines.find(item => item.id === spine.id)
        assert.ok(original)
        for (const key of ['neck_anim', 'neck_anim_stop']) {
          checked++
          assert.equal(spine[key], original[key], `${cue.cue}: stale ${key}`)
        }
      }
    }
  }
}
const shota = index.cards.find(card => card.resource_id === '002sht_r01').home_voice_cues.find(cue => cue.cue === '2_2_002_01_00_09').preview.preview_step
assert.equal(shota.state.spines[0].neck_anim, undefined)
assert.deepEqual(shota.timeline.filter(event => event.type === 'spine_neck_anim').map(event => [event.time, event.value]), [[1.5, 'neck_question']])
console.log(`Home neck source projection: ${checked} fields checked.`)

const supportedHomeCues = new Set(['spine_face', 'spine_anim', 'spine_neck_anim', 'spine_neck_stop'])
for (const card of index.cards) for (const cue of card.home_voice_cues || []) {
  for (const event of cue.preview?.preview_step?.timeline || []) {
    assert.ok(supportedHomeCues.has(event.type), `Home scheduler needs a handler for ${event.type}`)
  }
}
console.log('Home source contract: Shota single neck cue and supported timeline types passed')
