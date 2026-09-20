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

export function buildCardVoicePreviewScenario(card, cue) {
  const preview = cardVoicePreviewStep(card, cue)
  if (!preview) return null
  const cueId = typeof cue === 'string' ? cue : cue.cue
  const step = JSON.parse(JSON.stringify(preview.preview_step))
  step.step_id = 1
  return {
    scenario_id: `card_voice_preview_${card.resource_id}_${cueId}`,
    source_scenario_id: preview.scenario_id,
    source_compiled_file: preview.compiled_file,
    total_steps: 1,
    steps: [step],
  }
}
