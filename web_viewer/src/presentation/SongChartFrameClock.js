// Returns null when this display callback does not need a visual update.
// The deadline advances on the target grid, with half a millisecond of rAF
// tolerance. Never integrate media time here: audio.currentTime is the clock.
export function songChartFrameTime(previous, now, hz) {
  const interval = 1000 / hz
  if (previous === null) return now
  if (now - previous < interval - .5) return null
  return previous + Math.max(1, Math.floor((now - previous + .5) / interval)) * interval
}
