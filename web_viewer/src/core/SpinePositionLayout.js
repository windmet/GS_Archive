/** A position frame records the viewport used to convert game coordinates.
 * Explicit story baselines are fixed pixels; a null baseline follows height. */
export function positionFrame(manager, baseY = null) {
  return { width: manager.width, height: manager.height, baseY }
}

export function positionBaseline(frame, height = frame.height) {
  return frame.baseY ?? height + 20
}

export function projectSpinePosition(point, frame, manager) {
  const ratio = manager.width / frame.width
  return { x: point.x * ratio,
    y: positionBaseline(frame, manager.height) + (point.y - positionBaseline(frame)) * ratio }
}

export function recordSpinePosition(entry, manager, baseY = null) {
  if (!manager.responsiveSpinePositions) return
  entry._positionLayout = positionFrame(manager, baseY)
  if (entry.positioning) {
    entry.positioning.targetY = entry.spine.y
    entry.positioning.finalRootY = entry.spine.y
  }
}

export function resizeSpinePosition(entry, manager) {
  if (!manager.responsiveSpinePositions || !entry?.spine || entry.spine.destroyed) return
  if (entry._slideTweenRaf && entry._positionTween) {
    // Render the last sampled progress, without sampling/advancing the clock.
    entry._positionTween.render()
    return
  }
  const frame = entry._positionLayout
  if (!frame || !(frame.width > 0) || !(manager.width > 0)) return
  const point = projectSpinePosition(entry.spine, frame, manager)
  entry.spine.x = point.x
  entry.spine.y = point.y
  recordSpinePosition(entry, manager, frame.baseY)
}
