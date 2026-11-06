import { voicePreviewScenario } from './voicePreviewScenario.js'

// Only source-backed home dialogue can enter the story renderer.
/** Resolve only cues evidenced for this card; arbitrary URL voice IDs are rejected. */
export function findCardVoiceCue(card, voiceId, operationalCues = []) {
  return (card.home_voice_cues || []).find(item => item?.cue === voiceId) ||
    operationalCues.find(item => item?.cue === voiceId) ||
    Object.values(card.card_text_voices || {}).find(item => item === voiceId) ||
    (card.voice_candidates?.unmapped_card_only || []).find(item => item === voiceId)
}

export function cardVoicePreviewStep(card, cue) {
  const cueId = typeof cue === 'string' ? cue : cue?.cue
  const home = card?.home_voice_cues?.find(item => item.cue === cueId)
  const step = home?.preview?.preview_step
  // A text transcript or cue ID is not evidence of a model, lip curve or scene.
  if (!step?.dialogue?.text?.trim() || step.dialogue.text.trim() === '0' ||
      step.dialogue.voice?.replace(/\.(m4a|ogg|wav)$/i, '') !== cueId) return null
  return home.preview
}

// translate(source) returns the touch voice's archive translation ('' for none). The player then
// shows it like any story line, following the reader's text setting.
export function buildCardVoicePreviewScenario(card, cue, { translate } = {}) {
  const preview = cardVoicePreviewStep(card, cue)
  if (!preview) return null
  const cueId = typeof cue === 'string' ? cue : cue.cue
  return voicePreviewScenario({ id: `card_voice_preview_${card.resource_id}_${cueId}`, step: preview.preview_step,
    sourceScenarioId: preview.scenario_id, sourceCompiledFile: preview.compiled_file, translate })
}
