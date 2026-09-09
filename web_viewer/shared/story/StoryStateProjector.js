const clone = value => value == null ? null : JSON.parse(JSON.stringify(value))
const clamp = value => Math.min(1, Math.max(0, value))
const ease = value => 1 - (1 - value) ** 3
const mix = (a, b, t) => a + (b - a) * t
const progress = (cue, time) => cue.duration === 0 ? 1 : clamp((time - cue.start) / cue.duration)
const supported = new Set(['camera.transform', 'background.change', 'screen.fade', 'screen.directional_wipe', 'spine.visual.tint'])
function tintValue(value) {
  if (!value) return 0xFFFFFF
  return typeof value === 'string' && /^#?[a-fA-F0-9]{6}$/.test(value) ? parseInt(value.replace('#', ''), 16) : null
}
function tintAt(motion, time) {
  if (!motion.cue) return motion.to
  const t = ease(progress(motion.cue, time))
  return [16, 8, 0].reduce((color, shift) => color | (Math.round(mix((motion.from >> shift) & 255, (motion.to >> shift) & 255, t)) << shift), 0)
}
function finite(value, name, minimum = 0) {
  if (!Number.isFinite(value) || value < minimum) throw new TypeError(`Invalid projector ${name}`)
  return value
}
function cameraTransform(camera, viewport) {
  const scale = camera?.zoom ?? 1
  finite(scale, 'camera zoom', Number.MIN_VALUE)
  const x = camera?.offset_x ?? 0, y = camera?.offset_y ?? 0
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('Invalid projector camera offset')
  return { scale, x: viewport.width / 2 * (1 - scale) - x * viewport.width / 1280 * scale,
    y: viewport.height / 2 * (1 - scale) - y * viewport.width / 1280 * scale }
}
function cameraAt(motion, time) {
  if (!motion.cue) return motion.to
  const t = ease(progress(motion.cue, time))
  return Object.fromEntries(['scale', 'x', 'y'].map(key => [key, mix(motion.from[key], motion.to[key], t)]))
}
function initialScreen(overlay) {
  return {
    fade: { visible: !!overlay?.visible && overlay.kind === 'fade', color: overlay?.kind === 'fade' ? overlay.color : '#000000',
      alpha: overlay?.visible && overlay.kind === 'fade' ? clamp(overlay.alpha ?? 1) : 0 },
    wipe: { visible: !!overlay?.visible && overlay.kind === 'directional-wipe',
      color: overlay?.kind === 'directional-wipe' ? overlay.color : '#000000', x: 0, y: 0 },
  }
}

/** Pure, stateless semantic query. No renderer/runtime imports or external clock. */
export function projectStoryState(scenario, { stepIndex, time, viewport, context = {} }) {
  if (scenario?.schema_version !== 2 || !Array.isArray(scenario.steps)) throw new TypeError('Projector requires normalized v2')
  if (!Number.isInteger(stepIndex) || !scenario.steps[stepIndex]) throw new RangeError('Invalid projector stepIndex')
  finite(time, 'time')
  finite(viewport?.width, 'viewport width', Number.MIN_VALUE)
  finite(viewport?.height, 'viewport height', Number.MIN_VALUE)
  const step = scenario.steps[stepIndex]
  if (context.entrySnapshot && (typeof context.historyId !== 'string' || !context.historyId.trim())) throw new TypeError('Resolved entry requires historyId')
  if (context.cuePolicy && !['replay', 'suppressed'].includes(context.cuePolicy)) throw new TypeError('Unknown cue policy')
  if (context.cuePolicy === 'suppressed' && !context.entrySnapshot) throw new TypeError('Suppressed restore requires resolved entry')
  const entry = context.entrySnapshot || step.entry_snapshot
  if (!entry || !Array.isArray(step.cues)) throw new TypeError('Normalized step requires entry_snapshot and cues')
  const ids = new Set()
  const cues = step.cues.map((cue, ordinal) => {
    if (!cue.cue_id || ids.has(cue.cue_id)) throw new TypeError('Cue identity must be unique')
    ids.add(cue.cue_id)
    finite(cue.at, 'cue at'); finite(cue.duration, 'cue duration')
    const start = context.startedAt?.[cue.cue_id] ?? cue.at
    finite(start, 'cue start', cue.at)
    return { ...cue, start, ordinal }
  }).sort((a, b) => a.start - b.start || a.ordinal - b.ordinal)
  for (const id of Object.keys(context.startedAt || {})) if (!ids.has(id)) throw new TypeError('Unknown cue start identity')
  const coverage = { status: 'partial', unsupported_cues: cues.filter(c => !supported.has(c.action)).map(c => c.cue_id),
    unmapped_fields: clone(step.normalization?.unmapped_legacy_fields || []), limitations: ['spine-animation', 'filters', 'particles', 'background-geometry', 'audio-side-effects'] }
  let camera = { to: cameraTransform(entry.camera_zoom, viewport) }
  let background = { status: 'projected', layers: entry.bg ? [{ bg: entry.bg, alpha: 1 }] : [] }
  let backgroundCue = null, backgroundFrom = entry.bg || null
  const screen = initialScreen(entry.screen_overlay)
  const tintMotions = new Map((entry.spines || []).map(spine => [spine.id, { to: tintValue(spine.idol_color),
    blocked: coverage.unmapped_fields.includes(`state.spines.${spine.id}.idol_color_transition`) }]))
  for (const cue of cues) {
    if (context.cuePolicy === 'suppressed' || cue.start > time || !supported.has(cue.action)) continue
    const p = cue.payload || {}
    if (cue.action === 'spine.visual.tint') {
      const motion = tintMotions.get(cue.target), to = tintValue(p.value)
      if (!motion || motion.blocked || motion.to === null || to === null) {
        coverage.unsupported_cues.push(cue.cue_id)
        if (motion) motion.blocked = true
        continue
      }
      tintMotions.set(cue.target, { from: tintAt(motion, cue.start), to, cue })
    } else if (cue.action === 'camera.transform') {
      camera = { from: cameraAt(camera, cue.start), to: cameraTransform(p, viewport), cue }
    } else if (cue.action === 'background.change') {
      if (p.type && p.type !== 'dissolve') {
        background.status = 'not-projected'; coverage.unsupported_cues.push(cue.cue_id)
      }
      if (backgroundCue && cue.start < backgroundCue.start + backgroundCue.duration) {
        background.status = 'not-projected'; coverage.limitations.push('overlapping-background-transitions')
      }
      backgroundFrom = backgroundCue ? backgroundCue.payload.bg : backgroundFrom
      backgroundCue = cue
    } else if (cue.action === 'screen.fade') {
      finite(p.alpha ?? 1, 'fade alpha')
      if (!['in', 'out'].includes(p.type)) { screen.status = 'not-projected'; coverage.unsupported_cues.push(cue.cue_id); continue }
      const t = ease(progress(cue, time)), alpha = clamp(p.alpha ?? 1)
      screen.fade = { visible: p.type !== 'in' || t < 1, color: p.color || '#000000', alpha: alpha * (p.type === 'in' ? 1 - t : t) }
    } else {
      const t = ease(progress(cue, time)), factor = p.type === 'out' ? t : t - 1
      const direction = String(p.direction || '6')
      const offset = { '2': [0, viewport.height], '4': [-viewport.width, 0], '6': [viewport.width, 0], '8': [0, -viewport.height] }[direction]
      if (!offset || !['in', 'out'].includes(p.type)) { screen.status = 'not-projected'; coverage.unsupported_cues.push(cue.cue_id); continue }
      screen.wipe = { visible: p.type !== 'out' || t < 1, color: p.color || '#000000', x: offset[0] * factor, y: offset[1] * factor }
    }
  }
  if (backgroundCue && background.status === 'projected') {
    const t = progress(backgroundCue, time), bg = backgroundCue.payload.bg
    background.layers = backgroundFrom === bg ? [{ bg, alpha: 1 }]
      : [...(backgroundFrom && t < 1 ? [{ bg: backgroundFrom, alpha: 1 - t }] : []), ...(bg ? [{ bg, alpha: t }] : [])]
  } else if (background.status !== 'projected') background.layers = null
  const geometry = background.layers?.map(({ bg }) => {
    const size = context.backgroundTextures?.[bg]
    if (!(Number.isFinite(size?.width) && size.width > 0 && Number.isFinite(size?.height) && size.height > 0)) return null
    const scale = viewport.height / size.height, width = size.width * scale
    return { bg, x: Math.round((viewport.width - width) / 2), y: 0,
      width, height: size.height * scale, scaleX: scale, scaleY: scale, anchorX: 0, anchorY: 0 }
  })
  const geometryReady = !!geometry && geometry.every(Boolean)
  if (geometryReady) coverage.limitations = coverage.limitations.filter(item => item !== 'background-geometry')
  return {
    projector_version: 1, step_index: stepIndex, step_id: step.step_id, time,
    basis: { cue_policy: context.cuePolicy || 'replay', entry: context.entrySnapshot ? 'resolved-entry' : 'compiled-entry', history_id: context.historyId || null,
      timing: Object.keys(context.startedAt || {}).length ? 'explicit-starts' : 'asset-ready-semantic' },
    background, camera: { status: 'projected', ...cameraAt(camera, time) }, screen: { status: 'projected', ...screen },
    backgroundGeometry: { status: geometryReady ? 'projected' : 'not-projected',
      space: 'background-container-local', layers: geometryReady ? geometry : null },
    spines: { status: 'not-projected', entry: clone(entry.spines || []) },
    spineTints: { status: [...tintMotions.values()].some(m => m.blocked || m.to === null) ? 'partial' : 'projected',
      entries: [...tintMotions].map(([id, motion]) => ({ id, status: motion.blocked || motion.to === null ? 'not-projected' : 'projected',
        tint: motion.blocked || motion.to === null ? null : tintAt(motion, time) })) },
    filters: { status: 'not-projected', entry: { bg_color: clone(entry.bg_color), bg_dof: clone(entry.bg_dof) } },
    effects: { status: 'not-projected', entry: { bg: clone(entry.bg_effects || []), screen: clone(entry.screen_effects || []) } },
    coverage,
  }
}
