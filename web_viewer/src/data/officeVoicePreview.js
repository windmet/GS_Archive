// Yamamura's office system lines as one-step player scenarios (see scripts/build-office-voice-previews.py).
// translate(source) returns the office-voice archive translation ('' for none).
export async function buildOfficeVoicePreviewScenario(cue, { translate } = {}) {
  const { default: data } = await import('./officeVoicePreviews.json')
  const preview = data.previews[cue]
  if (!preview) throw new Error(`没有 ${cue} 的演出数据`)
  const step = JSON.parse(JSON.stringify(preview.step))
  step.step_id = 1
  const translated = typeof translate === 'function' ? translate(step.dialogue.text) : ''
  if (translated) step.dialogue.text_cn = translated
  return {
    scenario_id: `office_voice_preview_${cue}`,
    source_scenario_id: preview.source_scenario_id,
    total_steps: 1,
    steps: [step],
  }
}
