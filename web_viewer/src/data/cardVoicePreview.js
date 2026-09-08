// Card evidence -> a single-step player payload. No Vue, route, or player state.
// Source preview steps stay authoritative; only fallback steps resolve a speaker.
/** Resolve only cues evidenced for this card; arbitrary URL voice IDs are rejected. */
export function findCardVoiceCue(card, voiceId, operationalCues = []) {
  return (card.home_voice_cues || []).find(item => item?.cue === voiceId) ||
    operationalCues.find(item => item?.cue === voiceId) ||
    Object.values(card.card_text_voices || {}).find(item => item === voiceId) ||
    (card.voice_candidates?.unmapped_card_only || []).find(item => item === voiceId)
}

export function buildCardVoicePreviewScenario(card, cue, resolveSpeaker) {
  const cueId = typeof cue === 'string' ? cue : cue.cue
  const preview = typeof cue === 'object' ? cue.preview : null
  const cueText = typeof cue === 'object' && cue.text ? cue.text : `${card.title || card.resource_id}\n${cueId}`
  if (preview?.preview_step) {
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
  const charaId = card.character_id || card.resource_id?.slice(0, 6) || ''
  const voiceBase = card.voice_base || cueId.split('_').slice(0, 5).join('_')
  const model = `${charaId}_002_00`
  return {
    scenario_id: `card_voice_preview_${card.resource_id}_${cueId}`,
    total_steps: 1,
    steps: [
      {
        step_id: 1,
        type: 'adv',
        chara_id: charaId,
        state: {
          bg: 'bg001_315pro_in_01',
          bg_effect: null,
          bg_transition: null,
          bg_effects: [],
          bg_profile: null,
          bgm: null,
          bgm_volume: 100,
          se: null,
          se_events: [],
          environmental: null,
          spines: [
            {
              id: charaId,
              model,
              face: 'face_default',
              anim: 'wait_loop',
              position: 0,
              visible: true,
              pos_x: 0,
              pos_y: 0,
              fade: { type: 'in', delay: 0, duration: 0 },
            },
          ],
          talk_mode: false,
          phone_mode: false,
          camera_zoom: null,
          screen_fade: null,
          screen_slide: null,
          screen_effects: [],
          bgm_stop_fade: null,
          environmental_volume: null,
          environmental_duck_target: null,
          camera_filter: null,
          bg_color: null,
          bg_dof: null,
          bg_color_transition: null,
          bg_dof_transition: null,
          text_disabled: false,
          image_icon: null,
        },
        dialogue: {
          speaker: resolveSpeaker(charaId) || 'Cards',
          text: cueText,
          text_jp: cueText,
          text_cn: '',
          voice: `${cueId}.m4a`,
          lip: {
            source: 'adxlip',
            path: `adxlip/${charaId}/${voiceBase}/${cueId}.json`,
          },
        },
      },
    ],
  }
}

