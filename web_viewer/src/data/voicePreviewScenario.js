// One voiced line as a player scenario: card touch voices, Yamamura's office lines and the profile
// self-introduction. The player shows it in preview mode (one line, replay or return at its end).
// translate(source) returns the line's archive translation ('' for none); it rides inline (text_cn,
// bound to the step's own text_ref hash), so text_source tells the player there is no scenario overlay.
export function voicePreviewScenario({ id, step, sourceScenarioId, sourceCompiledFile, translate }) {
  const line = JSON.parse(JSON.stringify(step))
  line.step_id = 1
  const translated = typeof translate === 'function' ? translate(line.dialogue.text) : ''
  if (translated) line.dialogue.text_cn = translated
  return {
    scenario_id: id,
    source_scenario_id: sourceScenarioId,
    ...(sourceCompiledFile ? { source_compiled_file: sourceCompiledFile } : {}),
    text_source: 'inline',
    total_steps: 1,
    steps: [line],
  }
}

export const isVoicePreviewScenario = scenario => scenario?.text_source === 'inline'
