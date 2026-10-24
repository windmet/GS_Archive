// Client 2.6.10: LiveSettingsData.GetReadTime (0x1c1b160).
// The settings panel stores integers 10..110 and displays setting / 10.
// Keep float32 operations: fixtures execute the ARM64 method, not this formula.
export function songTrackReadTimeSeconds(speed) {
  if (!Number.isFinite(speed) || speed < 1 || speed > 11) throw new Error('Invalid native speed')
  const setting = Math.round(speed * 10)
  return Math.fround(Math.fround(120 - setting) * Math.fround(.05))
}

// A preview window is expressed in source ticks; native read time is seconds.
// Integrating both endpoints also handles a tempo change inside the window.
export function songTrackSpanForSpeed(speed, timing, cursor = 0) {
  const seconds = songTrackReadTimeSeconds(speed)
  if (!timing || !Number.isFinite(cursor) || cursor < 0) throw new Error('Invalid track timing')
  return timing.secondsToTick(timing.tickToSeconds(cursor) + seconds) - cursor
}

// NoteMesh.GetNoteTime (0x20bcebc): RAW speed is stored as a float32 and
// divides the base lead time. It is independent of the user's speed setting.
export function songTrackNoteReadTime(leadSeconds, speed = 1) {
  const nativeSpeed = Math.fround(speed)
  if (!Number.isFinite(leadSeconds) || leadSeconds <= 0 || !Number.isFinite(nativeSpeed) || nativeSpeed <= 0) {
    throw new Error('Invalid native note timing')
  }
  return leadSeconds / nativeSpeed
}

export function songTrackNoteTime(currentSeconds, hitSeconds, leadSeconds, speed = 1) {
  if (!Number.isFinite(currentSeconds) || !Number.isFinite(hitSeconds)) throw new Error('Invalid native note timing')
  return (currentSeconds - hitSeconds) / songTrackNoteReadTime(leadSeconds, speed)
}
