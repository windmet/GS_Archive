import assert from 'node:assert/strict'

import {
  buildCompiledScenarioMigrationReport,
  renderCompiledScenarioMigrationSummary,
} from './lib/compiled-scenario-migration.mjs'

const oldScenario = {
  scenario_id: 'migration_fixture',
  total_steps: 2,
  steps: [
    {
      step_id: 1,
      type: 'adv',
      episode_index: 0,
      episode_part: 'a',
      state: { bg: 'bg001', camera_zoom: null },
      dialogue: {
        speaker: '都築 圭',
        text_jp: 'おはようございます。',
        text_cn: '',
        voice: 'voice_001.m4a',
        lip: { path: 'voice_001.json', source: 'compiled' },
      },
      timeline: [{ type: 'idol_face', delay: 0.5, duration: 0 }],
    },
    {
      step_id: 2,
      type: 'choice',
      episode_index: 0,
      episode_part: 'a',
      state: { bg: 'bg001', camera_zoom: null },
      options: [{ label: 'continue', step_id: 1, source_text: '続ける' }],
    },
  ],
}

const textOnlyMigration = structuredClone(oldScenario)
textOnlyMigration.schema_version = 2
textOnlyMigration.compiler_version = 'fixture-v2'
textOnlyMigration.text_catalog_id = 'migration_fixture'
textOnlyMigration.text_contract_version = 1
textOnlyMigration.steps[0].dialogue.source_text = textOnlyMigration.steps[0].dialogue.text_jp
delete textOnlyMigration.steps[0].dialogue.text_jp
delete textOnlyMigration.steps[0].dialogue.text_cn
textOnlyMigration.steps[0].dialogue.text_ref = {
  unit_id: 'story-text:v1:migration_fixture:part_a:cmd-000001:dialogue:000',
  source_hash: 'sha256:fixture',
}
textOnlyMigration.steps[0].dialogue.speaker_identity = {
  kind: 'idol',
  entity_type: 'idol',
  entity_id: '007kei',
  source_name: '都築 圭',
}
textOnlyMigration.steps[1].choice_id = 'choice:v1:migration_fixture:part_a:cmd-000002'
textOnlyMigration.steps[1].options[0].option_id = 'choice-option:v1:migration_fixture:part_a:cmd-000002:000'
textOnlyMigration.steps[1].options[0].text_ref = {
  unit_id: 'story-text:v1:migration_fixture:part_a:cmd-000002:choice_short:000',
  source_hash: 'sha256:choice-fixture',
}

const accepted = buildCompiledScenarioMigrationReport(oldScenario, textOnlyMigration)
assert.equal(accepted.acceptance.passed, true)
assert.equal(accepted.non_text_differences.count, 0)
assert.equal(accepted.text_identity.added_unit_ids.length, 2)
assert.equal(accepted.text_identity.added_choice_ids.length, 1)
assert.equal(accepted.text_identity.added_option_ids.length, 1)
assert.match(renderCompiledScenarioMigrationSummary(accepted), /acceptance: PASS/u)

const changedRuntime = structuredClone(textOnlyMigration)
changedRuntime.steps[0].state.bg = 'bg002'
changedRuntime.steps[0].dialogue.voice = 'voice_002.m4a'
changedRuntime.steps[0].timeline[0].delay = 0.75
changedRuntime.steps[1].options[0].step_id = 99

const rejected = buildCompiledScenarioMigrationReport(oldScenario, changedRuntime)
assert.equal(rejected.acceptance.passed, false)
assert.ok(rejected.non_text_differences.count >= 3)
assert.equal(rejected.scene_state.difference_count, 1)
assert.equal(rejected.choice_targets.unchanged, false)
assert.equal(rejected.dialogue_audio.unchanged, false)
assert.equal(rejected.cue_profile.unchanged, false)
assert.ok(rejected.non_text_differences.records.some(record => record.path.endsWith('/state/bg')))

const changedBoundary = structuredClone(textOnlyMigration)
changedBoundary.steps[1].episode_part = 'b'
const boundaryReport = buildCompiledScenarioMigrationReport(oldScenario, changedBoundary)
assert.equal(boundaryReport.episode_boundaries.unchanged, false)
assert.equal(boundaryReport.acceptance.passed, false)

const changedSourceText = structuredClone(textOnlyMigration)
changedSourceText.steps[0].dialogue.source_text = '原文が変わりました。'
const textReport = buildCompiledScenarioMigrationReport(oldScenario, changedSourceText)
assert.equal(textReport.text_content.unchanged, false)
assert.equal(textReport.non_text_differences.count, 0)
assert.equal(textReport.acceptance.passed, false)

console.log('Compiled scenario migration audit verification passed')
console.log('  text-only evidence additions accepted')
console.log('  scene, voice/lip, cue, choice target, and episode boundary drift rejected')
console.log('  legacy and v2 source text are compared without allowing silent rewrites')
