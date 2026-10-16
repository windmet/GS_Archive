// LiveStage's 1280x720 design-plane scale (0x1f29edc), not the responsive
// browser aspect ratio. The viewer letterboxes this fixed native plane.
export const PINSPOTLIGHT_STAGE_SCALE = Math.fround(1000 / 720)
const pixelToCamera = Math.fround(PINSPOTLIGHT_STAGE_SCALE / 100)
export const PINSPOTLIGHT_TARGET_OFFSET = Math.fround(150 * pixelToCamera) * 100

export function pinspotlightPoint(event, time, placement) {
  if (event.stagePosition > 0) {
    const target = placement(event.stagePosition, time)
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return null
    return { x: target.x, y: 360 - target.y - PINSPOTLIGHT_TARGET_OFFSET }
  }
  // ScriptPosToCameraPos differs from the idol's ScriptPosToStagePos.
  return { x: Number(event.x || 0) * pixelToCamera * 100,
    y: (360 - Number(event.y || 0)) * pixelToCamera * 100 }
}

const progress = (time, start, duration) => duration <= 0 ? 1 : Math.max(0, Math.min(1, (time - start) / duration))
// Show explicitly selects Ease.OutBack (27); Hide uses DOTween's OutQuad.
const overshoot = Math.fround(1.70158)
const outBack = t => { const v = t - 1; return 1 + v * v * ((overshoot + 1) * v + overshoot) }
function sample(state, time, placement) {
  if (!state) return null
  const t = progress(time, state.start, state.duration)
  const p = !state.showing ? state.from : t < 1
    ? { x: state.from.x + (state.to.x - state.from.x) * outBack(t),
      y: state.from.y + (state.to.y - state.from.y) * outBack(t) }
    : pinspotlightPoint(state, time, placement)
  return { ...state, point: p, alpha: state.showing ? state.alpha : state.alpha * (1 - t) ** 2 }
}

// Rebuild on seek, retaining only native per-object state. Target changes
// start at the previous projected position; follow resumes after the tween.
export function pinspotlightTimelineAt(events, time, placement) {
  const states = new Map()
  for (const event of events || []) {
    if (event.time > time) break
    const previous = sample(states.get(event.id), event.time, placement)
    if (event.hide) {
      if (previous?.point) states.set(event.id, { ...previous, showing: false,
        from: previous.point, start: event.time, duration: Math.max(0, event.duration || 0) })
      continue
    }
    const to = pinspotlightPoint(event, event.time, placement)
    if (!to) { states.delete(event.id); continue }
    states.set(event.id, { ...event,
      beamColor: event.beamColor || previous?.beamColor || null,
      showing: true, alpha: previous?.showing ? previous.alpha : 1,
      start: event.time, duration: Math.max(0, event.duration || 0), to,
      from: previous?.showing && previous.point ? previous.point : to })
  }
  return new Map([...states].map(([id, state]) => [id, sample(state, time, placement)]))
}
