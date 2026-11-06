import { voicePreviewScenario } from './voicePreviewScenario.js'

// Yamamura's office system lines as one-step player scenarios (see scripts/build-office-voice-previews.py).
// translate(source) returns the office-voice archive translation ('' for none).
export async function buildOfficeVoicePreviewScenario(cue, { translate } = {}) {
  const { default: data } = await import('./officeVoicePreviews.json')
  const preview = data.previews[cue]
  if (!preview) throw new Error(`没有 ${cue} 的演出数据`)
  return voicePreviewScenario({ id: `office_voice_preview_${cue}`, step: preview.step,
    sourceScenarioId: preview.source_scenario_id, translate })
}
