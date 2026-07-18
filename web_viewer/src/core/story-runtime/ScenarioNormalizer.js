const LEGACY_SCHEMA_VERSION = 1
const CURRENT_SCHEMA_VERSION = 2

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function cueLifecycle({ persistence = 'stateful', skippable = true, blocksInput = false, blocksAuto = true, restorePolicy = 'settled' } = {}) {
  return {
    persistence,
    skippable,
    blocks_input: blocksInput,
    blocks_auto: blocksAuto,
    restore_policy: restorePolicy,
  }
}

function makeCue(step, ordinal, {
  suffix,
  at = 0,
  duration = 0,
  channel,
  action,
  target = null,
  payload = {},
  lifecycle,
  legacyField,
}) {
  return {
    cue_id: `step-${step.step_id ?? 'unknown'}:${String(ordinal).padStart(3, '0')}:${suffix}`,
    at: Math.max(0, finiteNumber(at)),
    duration: Math.max(0, finiteNumber(duration)),
    channel,
    action,
    target,
    payload: clone(payload),
    lifecycle: lifecycle || cueLifecycle(),
    evidence: {
      confidence: 'derived',
      legacy_field: legacyField,
    },
  }
}

function stableCamera(camera) {
  if (!camera) return null
  const result = clone(camera)
  result.duration = 0
  delete result.delay
  return result
}

function stableScreenOverlayFromCue(screenSlide, screenFade) {
  if (screenSlide) {
    return screenSlide.type === 'in'
      ? {
          kind: 'directional-wipe',
          visible: true,
          color: screenSlide.color || '#000000',
          direction: String(screenSlide.direction || '6'),
        }
      : null
  }
  if (screenFade) {
    return screenFade.type === 'out'
      ? {
          kind: 'fade',
          visible: true,
          color: screenFade.color || '#000000',
          alpha: finiteNumber(screenFade.alpha, 1),
        }
      : null
  }
  return undefined
}

function stripLegacyTransientState(state) {
  const settled = clone(state || {})
  settled.se = null
  settled.se_events = []
  settled.screen_fade = null
  settled.screen_slide = null
  settled.screen_effects = []
  settled.bg_transition = null
  settled.bg_dof_transition = null
  settled.bg_color_transition = null
  settled.bgm_stop_fade = null
  settled.environmental_duck_target = null
  settled.text_disabled = false
  settled.camera_zoom = stableCamera(settled.camera_zoom)
  for (const effect of settled.bg_effects || []) {
    delete effect.action
    delete effect.delay
    delete effect.duration
  }
  for (const spine of settled.spines || []) {
    delete spine.fade
    delete spine.idol_color_transition
    delete spine.neck_anim
    delete spine.neck_anim_stop
  }
  return settled
}

function applyLegacyTimeline(settled, timeline) {
  for (const event of timeline || []) {
    const spine = (settled.spines || []).find(item => item.id === event.chara_id)
    if (!spine) continue
    if (event.type === 'spine_face') {
      spine.face = event.value
      if (event.anim_flag) spine.anim_flag = event.anim_flag
      if (event.blush_flag != null) spine.blush_flag = event.blush_flag
      if (event.sweat_flag != null) spine.sweat_flag = event.sweat_flag
    } else if (event.type === 'spine_anim') {
      spine.anim = event.value
      if (event.no_back) spine.anim_no_back = true
      else delete spine.anim_no_back
    } else if (event.type === 'spine_color') {
      spine.idol_color = event.value
    }
  }
}

function normalizeTimelineCue(step, event, ordinal) {
  const typeMap = {
    spine_face: { action: 'spine.face.set', channel: `spine:${event.chara_id}:face`, suffix: 'spine-face' },
    spine_anim: { action: 'spine.body.play', channel: `spine:${event.chara_id}:body`, suffix: 'spine-body' },
    spine_neck_anim: { action: 'spine.neck.play', channel: `spine:${event.chara_id}:neck`, suffix: 'spine-neck' },
    spine_neck_stop: { action: 'spine.neck.stop', channel: `spine:${event.chara_id}:neck`, suffix: 'spine-neck-stop' },
    spine_color: { action: 'spine.visual.tint', channel: `spine:${event.chara_id}:visual:tint`, suffix: 'spine-tint' },
  }
  const mapped = typeMap[event.type]
  if (!mapped) return null
  const isNeck = event.type === 'spine_neck_anim' || event.type === 'spine_neck_stop'
  return makeCue(step, ordinal, {
    ...mapped,
    at: event.time,
    duration: event.duration,
    target: event.chara_id,
    payload: { ...event, time: undefined, type: undefined, chara_id: undefined },
    lifecycle: cueLifecycle(isNeck
      ? { persistence: 'transient', restorePolicy: 'suppress' }
      : { persistence: 'stateful' }),
    legacyField: `timeline.${event.type}`,
  })
}

function buildLegacyCues(step) {
  const state = step.state || {}
  const cues = []
  const unmapped = []
  let ordinal = 0
  const push = cue => { if (cue) cues.push(cue); ordinal++ }

  const camera = state.camera_zoom
  const cameraDelay = finiteNumber(camera?.delay)
  const cameraDuration = finiteNumber(camera?.duration)
  if (camera && (cameraDelay > 0 || cameraDuration > 0)) {
    push(makeCue(step, ordinal, {
      suffix: 'camera-transform',
      at: cameraDelay,
      duration: cameraDuration,
      channel: 'camera',
      action: 'camera.transform',
      target: 'stage',
      payload: stableCamera(camera),
      lifecycle: cueLifecycle({ persistence: 'stateful' }),
      legacyField: 'state.camera_zoom',
    }))
  }

  const seEvents = Array.isArray(state.se_events) && state.se_events.length
    ? state.se_events
    : (state.se?.cue ? [state.se] : [])
  for (const se of seEvents) {
    if (!se?.cue) continue
    push(makeCue(step, ordinal, {
      suffix: `se-${se.cue}`,
      at: se.delay,
      channel: 'se',
      action: 'se.play',
      target: se.cue,
      payload: { cue: se.cue, volume: se.volume ?? null },
      lifecycle: cueLifecycle({
        persistence: 'transient',
        skippable: true,
        blocksAuto: false,
        restorePolicy: 'suppress',
      }),
      legacyField: 'state.se_events',
    }))
  }

  if (state.screen_slide) {
    const slide = state.screen_slide
    push(makeCue(step, ordinal, {
      suffix: 'screen-directional-wipe',
      at: slide.delay,
      duration: slide.duration,
      channel: 'screen',
      action: 'screen.directional_wipe',
      target: 'screen-overlay',
      payload: {
        type: slide.type || 'in',
        color: slide.color || '#000000',
        direction: String(slide.direction || '6'),
      },
      lifecycle: cueLifecycle({ persistence: 'transient', restorePolicy: 'settled' }),
      legacyField: 'state.screen_slide',
    }))
  }

  if (state.screen_fade) {
    const fade = state.screen_fade
    push(makeCue(step, ordinal, {
      suffix: 'screen-fade',
      at: fade.delay,
      duration: fade.duration,
      channel: 'screen',
      action: 'screen.fade',
      target: 'screen-overlay',
      payload: {
        type: fade.type || 'in',
        color: fade.color || '#000000',
        alpha: fade.alpha ?? 1,
      },
      lifecycle: cueLifecycle({ persistence: 'transient', restorePolicy: 'settled' }),
      legacyField: 'state.screen_fade',
    }))
  }

  for (const event of step.timeline || []) {
    const cue = normalizeTimelineCue(step, event, ordinal)
    if (!cue) unmapped.push(`timeline.${event?.type || 'unknown'}`)
    push(cue)
  }

  if (state.screen_effects?.length) unmapped.push('state.screen_effects')
  for (const spine of state.spines || []) {
    if (spine.fade) unmapped.push(`state.spines.${spine.id}.fade`)
    if (spine.idol_color_transition) unmapped.push(`state.spines.${spine.id}.idol_color_transition`)
  }

  return { cues, unmapped: [...new Set(unmapped)] }
}

function normalizeLegacyStep(step, previousSettledSnapshot) {
  const entrySnapshot = clone(step.state || {})
  entrySnapshot.screen_overlay = clone(previousSettledSnapshot?.screen_overlay || null)
  const camera = step.state?.camera_zoom
  if (camera && (finiteNumber(camera.delay) > 0 || finiteNumber(camera.duration) > 0)) {
    entrySnapshot.camera_zoom = stableCamera(previousSettledSnapshot?.camera_zoom)
      || { zoom: 1, offset_x: 0, offset_y: 0, duration: 0 }
  } else {
    entrySnapshot.camera_zoom = stableCamera(entrySnapshot.camera_zoom)
  }
  entrySnapshot.se = null
  entrySnapshot.se_events = []

  const settledSnapshot = stripLegacyTransientState(step.state)
  const screenOverlay = stableScreenOverlayFromCue(step.state?.screen_slide, step.state?.screen_fade)
  settledSnapshot.screen_overlay = screenOverlay === undefined
    ? clone(previousSettledSnapshot?.screen_overlay || null)
    : screenOverlay
  applyLegacyTimeline(settledSnapshot, step.timeline)
  const { cues, unmapped } = buildLegacyCues(step)

  return {
    ...clone(step),
    entry_snapshot: entrySnapshot,
    settled_snapshot: settledSnapshot,
    snapshot_format: 'legacy-state-v1',
    cues,
    flow: {
      advance: step.type === 'choice' ? 'choice' : (step.auto_advance ? 'automatic' : 'user'),
      blocks_skip: step.type === 'choice',
      choice_id: step.type === 'choice' ? `step-${step.step_id}` : null,
    },
    normalization: {
      source_schema_version: LEGACY_SCHEMA_VERSION,
      unmapped_legacy_fields: unmapped,
    },
  }
}

export function normalizeLegacyScenario(scenario) {
  if (!scenario || !Array.isArray(scenario.steps)) {
    throw new TypeError('legacy scenario must contain a steps array')
  }
  let previousSettledSnapshot = null
  const steps = scenario.steps.map(step => {
    const normalized = normalizeLegacyStep(step, previousSettledSnapshot)
    previousSettledSnapshot = normalized.settled_snapshot
    return normalized
  })
  return {
    ...clone(scenario),
    schema_version: CURRENT_SCHEMA_VERSION,
    source_schema_version: LEGACY_SCHEMA_VERSION,
    runtime_contract: 'story-runtime-v2-compat',
    steps,
    diagnostics: {
      ...(clone(scenario.diagnostics) || {}),
      normalization_warnings: steps.flatMap(step =>
        step.normalization.unmapped_legacy_fields.map(field => ({ step_id: step.step_id, field }))),
    },
  }
}

export function normalizeScenario(scenario) {
  const version = scenario?.schema_version ?? LEGACY_SCHEMA_VERSION
  if (version === LEGACY_SCHEMA_VERSION) return normalizeLegacyScenario(scenario)
  if (version === CURRENT_SCHEMA_VERSION) {
    if (!Array.isArray(scenario?.steps)) throw new TypeError('scenario v2 must contain a steps array')
    return clone(scenario)
  }
  throw new RangeError(`unsupported scenario schema version: ${version}`)
}

export { CURRENT_SCHEMA_VERSION, LEGACY_SCHEMA_VERSION }
