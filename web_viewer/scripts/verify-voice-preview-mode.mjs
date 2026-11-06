import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { voicePreviewScenario, isVoicePreviewScenario } from '../src/data/voicePreviewScenario.js'
import { buildIdolIntroPreviewScenario } from '../src/data/idolIntroPreview.js'
import { createVoiceLipStore, lipPathsForStep, warmLipCurves } from '../src/core/VoiceLipStore.js'
import { IDOL_INTRO_CUE, normalizeArchiveRoute } from '../src/core/archiveRoute.js'
import { archiveGeneralText } from '../src/presentation/ArchiveGeneralTextCore.mjs'
import { HOME_VOICE_KEYS } from '../src/localization/story/HomeVoiceTranslations.js'

// One voiced line (card voices, office lines, the profile self-introduction) plays in preview mode: its
// text is in before the player opens, its lip curve is warmed, it asks for no scenario overlay, and its
// end offers replay or return instead of the story's review and next episode.
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const root = new URL('../public/', import.meta.url)
const entries = JSON.parse(readFileSync(new URL('translations/zh-CN/archive-general/card-lines.json', root), 'utf8')).entries
const translate = text => HOME_VOICE_KEYS.map(([kind, field]) => archiveGeneralText(entries, kind, text, field, 'zh-CN')).find(value => value && value !== text) || ''

// The shared builder: a copy of the step as step 1, the translation inline, the preview marker.
{
  const step = { step_id: 7, type: 'adv', state: { bg: 'bg' }, dialogue: { text: '原文', voice: 'v.m4a', text_ref: { source_hash: 'sha256:x' } } }
  const scenario = voicePreviewScenario({ id: 'p', step, sourceScenarioId: 's', translate: () => '译文' })
  assert.equal(scenario.steps[0].step_id, 1)
  assert.equal(scenario.steps[0].dialogue.text_cn, '译文')
  assert.equal(step.step_id, 7, 'the source step is not mutated'); assert.equal(step.dialogue.text_cn, undefined)
  assert.ok(isVoicePreviewScenario(scenario)); assert.ok(!isVoicePreviewScenario({ scenario_id: '1_3_x', steps: [] }))
  assert.equal(voicePreviewScenario({ id: 'p', step, sourceScenarioId: 's', translate: () => '' }).steps[0].dialogue.text_cn, undefined)
}

// Every idol's self-introduction builds from its compiled IdolDetail scenario (here rebuilt from the tracked
// index, whose preview_step is that scenario's voiced step), with the card-lines self-intro translation.
const index = JSON.parse(readFileSync(new URL('data/masterdata/home_system_voice_index.json', root), 'utf8'))
let intros = 0
for (const idol of index.idols) for (const row of idol.idol_detail || []) {
  const compiled = { scenario_id: row.scenario_id, steps: [{ step_id: 1, type: 'fadeout', state: {} }, { ...row.preview_step, step_id: row.step_id }] }
  const requested = []
  const fetchImpl = async url => { requested.push(url); return { ok: true, json: async () => JSON.parse(JSON.stringify(compiled)) } }
  const intro = { file: row.compiled_file, scenarioId: row.scenario_id, stepId: row.step_id, voice: row.voice }
  const scenario = await buildIdolIntroPreviewScenario(intro, { translate, fetchImpl })
  assert.deepEqual(requested, [`/data/compiled/${row.compiled_file}`])
  assert.equal(scenario.total_steps, 1); assert.equal(scenario.steps[0].dialogue.voice, row.voice)
  assert.ok(scenario.steps[0].dialogue.text_cn, `${row.scenario_id}: self-introduction has no translation`)
  assert.equal(scenario.source_compiled_file, row.compiled_file); assert.ok(isVoicePreviewScenario(scenario))
  assert.ok(IDOL_INTRO_CUE.test(row.voice.replace(/\.m4a$/, '')), `${row.voice}: route cue pattern`)
  intros++
}
assert.equal(intros, 49)
await assert.rejects(buildIdolIntroPreviewScenario({ file: '1_3_001.json', voice: 'v.m4a' }, { fetchImpl: async () => assert.fail('fetched') }))
await assert.rejects(buildIdolIntroPreviewScenario({ file: '3_x_001tom_9_2_001.json', voice: 'other.m4a' },
  { fetchImpl: async () => ({ ok: true, json: async () => ({ scenario_id: 's', steps: [{ step_id: 2, dialogue: { voice: '9_2_001_00.m4a' } }] }) }) }))

// Warming asks for exactly the URLs the lip store asks for, falls through a 404 like it, and never
// holds a line past its deadline.
{
  const step = index.idols[0].idol_detail[0].preview_step
  const storeUrls = [], warmUrls = []
  await createVoiceLipStore({ fetchImpl: async url => { storeUrls.push(url); return { ok: false, status: 404, headers: new Map() } } }).load(step)
  await warmLipCurves([step], { fetchImpl: async url => { warmUrls.push(url); return { ok: false, status: 404 } } })
  assert.ok(storeUrls.length >= 1); assert.deepEqual(warmUrls, storeUrls, 'warming follows the store’s path order')
  assert.deepEqual(lipPathsForStep({ ...step, lipSync: false }), [])
  const stalled = await warmLipCurves([step], { fetchImpl: () => new Promise(() => {}), timeoutMs: 20 })
  assert.equal(stalled, 0, 'a stalled curve settles at the deadline')
  const many = Array.from({ length: 9 }, (_, n) => ({ dialogue: { voice: `2_1_001_01_00_0${n}.m4a` } })), asked = []
  await warmLipCurves(many, { fetchImpl: async url => { asked.push(url); return { ok: true, status: 200, arrayBuffer: async () => {} } } })
  assert.equal(asked.length, 6, 'only the first lines are warmed')
}

// A shared preview link keeps the player view only with the idol whose profile it returns to.
assert.equal(normalizeArchiveRoute({ view: 'player', idol: '001tom', voice: '9_2_001_00', returnView: 'idol_detail' }).view, 'player')
assert.notEqual(normalizeArchiveRoute({ view: 'player', voice: '9_2_001_00', returnView: 'idol_detail' }).view, 'player')

// Wiring: the player asks for no overlay for previews or home voices; the profile opens the preview;
// every preview starts (and replays) through one App entry; the viewer's preview end bar.
const context = source('src/localization/story/StoryLocalizationContext.js')
assert.match(context, /if \(isVoicePreviewScenario\(compiledData\?\.value\) \|\| isHomeVoiceScenario\(compiledData\?\.value\)\) return\n\s*const loaded = await repository\.loadScenario/)
const app = source('src/App.vue')
assert.match(app, /@play-introduction="previewIdolIntroduction"/)
assert.match(app, /@replay-preview="replayVoicePreview"/)
assert.equal((app.match(/playbackController\.preview\(/g) || []).length, 2, 'previews start in startVoicePreview and replay in replayVoicePreview only')
assert.match(app, /return playbackController\.preview\(makeScenario, cue, returnView, \{ syncRoute: false \}\)/)
assert.match(app, /const scenario = await build\([^\n]+\n\s*await warmLipCurves\(scenario\?\.steps\)/, 'previews warm their lip curves')
assert.match(app, /translatedPreview\(translate => buildIdolIntroPreviewScenario\(intro, \{ translate \}\), HOME_VOICE_KEYS\)/)
assert.match(source('src/components/archive/ArchiveIdolDetail.vue'), /emit\('play-introduction', selfIntroduction\)/)
assert.match(source('src/data/prepareScenario.js'), /const \{ entryIndex, endIndex \} = resolveStoryPlaybackWindow\(scenario, playbackEntry\)\n\s*void warmLipCurves\(scenario\.steps\.slice\(entryIndex, endIndex \+ 1\), \{ fetchImpl \}\)/)
const viewer = source('src/core/StoryViewer.vue')
assert.match(viewer, /!endBarOpen && !previewOnly"/, 'no dock in preview mode')
assert.match(viewer, /<div v-if="endBarOpen && previewOnly" class="episode-complete is-preview"[\s\S]*?data-preview-replay @click="replayPreview"[\s\S]*?emit\('back'\)/)
assert.match(viewer, /<div v-else-if="endBarOpen" class="episode-complete"/)
assert.match(viewer, /function replayPreview\(\) \{ emit\('replay-preview'\) \}/)
assert.match(viewer, /if \(props\.previewOnly && state === 'ended' && isLastStep\.value && !episodeFinished\.value\) goNext\(\)/)
for (const builder of ['src/data/cardVoicePreview.js', 'src/data/officeVoicePreview.js']) assert.match(source(builder), /return voicePreviewScenario\(/, `${builder} uses the shared builder`)
console.log(`Voice preview mode: shared builder, ${intros} self-introductions with translations, lip warming parity and deadline, intro route, overlay skip, App entry/replay and viewer end bar passed`)
