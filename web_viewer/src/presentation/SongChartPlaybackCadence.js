import { songChartFrameTime } from './SongChartFrameClock.js'

// Both consumers receive the same sampled media time. The track can animate
// without invalidating transport text, range inputs or navigation queries.
export function createSongChartPlaybackCadence({ track, controls }) {
  let trackFrame = null, controlsFrame = null, previousMode = null
  function reset() { trackFrame = null; controlsFrame = null; previousMode = null }
  function sync(seconds) {
    reset()
    track(seconds)
    controls(seconds)
  }
  function paint(now, seconds, perspective) {
    if (previousMode !== perspective) reset()
    previousMode = perspective
    const nextTrack = songChartFrameTime(trackFrame, now, perspective ? 60 : 30)
    const nextControls = songChartFrameTime(controlsFrame, now, perspective ? 10 : 30)
    if (nextTrack !== null) { trackFrame = nextTrack; track(seconds) }
    if (nextControls !== null) { controlsFrame = nextControls; controls(seconds) }
  }
  return { paint, sync, reset }
}
