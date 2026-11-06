import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolveStoryText } from '../src/localization/story/StoryTextResolver.js'
import { archiveGeneralText } from '../src/presentation/ArchiveGeneralTextCore.mjs'
import { HOME_VOICE_KEYS, homeVoiceOverlayEntry, isHomeVoiceScenario } from '../src/localization/story/HomeVoiceTranslations.js'

// Home and profile voices (3_x_*) carry no scenario overlay; the player must show the same card-lines
// (home-voice) translation the home page and the idol profile show. Uses the tracked home voice index
// (CI has no compiled corpus) and, when present, every compiled 3_x_* scenario.
const root = new URL('../public/', import.meta.url)
const entries = JSON.parse(readFileSync(new URL('translations/zh-CN/archive-general/card-lines.json', root), 'utf8')).entries
const translate = (kind, source, field) => { const text = archiveGeneralText(entries, kind, source, field, 'zh-CN'); return text && text !== source ? text : '' }
const show = (compiled, dialogue, producer) => resolveStoryText({ source: dialogue.source_text, textRef: dialogue.text_ref,
  overlayEntry: homeVoiceOverlayEntry(compiled, dialogue.source_text, dialogue.text_ref, translate),
  preferences: { story_content_mode: 'translation', story_translation_locale: 'zh-CN', producer_name: producer } })

const index = JSON.parse(readFileSync(new URL('data/masterdata/home_system_voice_index.json', root), 'utf8'))
let indexed = 0
// Stand voices (scenarios) and the profile self-introduction (idol_detail) both open in the player.
for (const idol of index.idols) for (const scenario of [...(idol.scenarios || []), ...(idol.idol_detail || [])]) {
  if (!scenario.text || !scenario.scenario_id) continue
  const compiled = { scenario_id: scenario.scenario_id }
  assert.ok(isHomeVoiceScenario(compiled), scenario.scenario_id)
  const expected = HOME_VOICE_KEYS.map(([kind, field]) => translate(kind, scenario.text, field)).find(Boolean)
  assert.ok(expected, `${scenario.scenario_id}: no home-voice translation for its line`)
  const view = show(compiled, { source_text: scenario.text, text_ref: null }, '')
  assert.ok(view.translation.available, `${scenario.scenario_id}: translation unavailable`)
  indexed++
}
assert.ok(indexed >= 1070, `only ${indexed} indexed home voices`)

// GS_COMPILED_DIR points a worktree without the corpus at a checkout that has it.
const compiledDir = process.env.GS_COMPILED_DIR ? pathToFileURL(`${process.env.GS_COMPILED_DIR}/`) : new URL('data/compiled/', root)
let lines = 0
if (existsSync(compiledDir)) for (const file of readdirSync(compiledDir).filter(name => /^3_x_.*\.json$/.test(name))) {
  const compiled = JSON.parse(readFileSync(new URL(file, compiledDir), 'utf8'))
  for (const step of compiled.steps) if (step.dialogue?.source_text) {
    for (const producer of ['', '测试']) assert.ok(show(compiled, step.dialogue, producer).translation.available, `${file}: line stays Japanese`)
    lines++
  }
}
// Only home voice catalogues borrow these entries.
assert.equal(homeVoiceOverlayEntry({ scenario_id: '1_3_10001_01_a' }, index.idols[0].scenarios[0].text, null, translate), null)
assert.equal(homeVoiceOverlayEntry({ scenario_id: '3_x_001tom_9_2_001' }, index.idols[0].scenarios[0].text,
  { unit_id: 'story-text:v1:other:x', source_hash: 'sha256:' + '0'.repeat(64) }, translate), null)
const context = readFileSync(new URL('../src/localization/story/StoryLocalizationContext.js', import.meta.url), 'utf8')
assert.match(context, /homeVoiceOverlayEntry\(compiledData\?\.value, source, textRef\)/, 'the player falls back to home-voice entries')
assert.match(context, /await loadHomeVoiceTranslations\(compiledData\.value\)/, 'the player waits for the lines before showing text')
console.log(`Home voice player text: ${indexed} indexed voices${lines ? ` and ${lines} compiled lines` : ''} show their card-lines translation`)
