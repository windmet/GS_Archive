// Pure decisions behind the bottom-sheet swipe-down (composables/useSheetDrag.js). Kept free of the DOM so the numbers can be
// tested: when a touch becomes a drag, how far a sheet may be pulled past its rest, and when letting go closes it.

// Pixels of movement before the direction is judged. Below this a touch is still a tap.
export const SHEET_DIRECTION_SLOP = 6
// Letting go closes the sheet when it is travelling down faster than this (px/ms), measured over the last SHEET_VELOCITY_WINDOW ms...
export const SHEET_CLOSE_VELOCITY = 0.11
export const SHEET_VELOCITY_WINDOW = 100
// ...or when it was pulled past this share of its own height.
export const SHEET_CLOSE_FRACTION = 1 / 3
// Pulling up past the rest position meets growing resistance and can never go further than this many px.
export const SHEET_RUBBER_LIMIT = 80

// 'pending' until the finger has moved SHEET_DIRECTION_SLOP, then whichever axis dominates.
export function gestureIntent(dx, dy) {
  if (Math.hypot(dx, dy) < SHEET_DIRECTION_SLOP) return 'pending'
  return Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal'
}

// A drag that starts on the header or handle always moves the sheet. One that starts in the content moves it only when it pulls
// down and the content is already at its top; otherwise it is an ordinary scroll and the sheet stays out of it.
export function takesOver({ fromHandle, scrollTop, dy }) {
  return Boolean(fromHandle) || (dy > 0 && scrollTop <= 0)
}

// Overshoot above the rest position, in px of finger travel -> px the sheet actually moves. Slope falls steadily, so each extra
// px of pull gives less than the one before.
export function rubberBand(overshoot) {
  const distance = Math.max(0, overshoot)
  return (SHEET_RUBBER_LIMIT * distance) / (distance + SHEET_RUBBER_LIMIT)
}

// Where the sheet sits for a finger offset: 1:1 downward, resisted upward.
export function sheetOffset(fingerOffset) {
  return fingerOffset >= 0 ? fingerOffset : -rubberBand(-fingerOffset)
}

// Downward speed (px/ms) over the last SHEET_VELOCITY_WINDOW ms of [{ t, y }] samples (oldest first).
export function releaseVelocity(samples, now) {
  const recent = samples.filter(sample => now - sample.t <= SHEET_VELOCITY_WINDOW)
  if (recent.length < 2) return 0
  const first = recent[0], last = recent.at(-1)
  return last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0
}

export function shouldCloseSheet({ offset, velocity, height }) {
  if (offset <= 0) return false
  return velocity > SHEET_CLOSE_VELOCITY || offset > height * SHEET_CLOSE_FRACTION
}

// The gesture belongs to a sheet only while it is in its bottom form: as wide as the viewport and resting on its bottom edge.
// This is the same fact the CSS media queries produce, without copying their widths (they differ per component).
export function isBottomSheet(rect, viewport, tolerance = 4) {
  return rect.width >= viewport.width - tolerance && Math.abs(rect.bottom - viewport.height) <= tolerance && rect.top > 0
}
