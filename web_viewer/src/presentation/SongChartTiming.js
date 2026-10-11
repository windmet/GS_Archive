// The stage's media clock is seconds. Fumen uses 480 ticks per quarter beat;
// integrate every tempo segment rather than stretching the chart to the file.
export const SONG_TICKS_PER_BEAT = 480
export function buildSongChartTiming(chart) {
  const offset = Number(chart.offset) || 0
  let seconds = offset
  const segments = chart.tempos.map((tempo, index) => {
    const previous = chart.tempos[index - 1]
    if (previous) seconds += (tempo.tick - previous.tick) * 60 / (SONG_TICKS_PER_BEAT * previous.tempo)
    return { tick: tempo.tick, seconds, secondsPerTick: 60 / (SONG_TICKS_PER_BEAT * tempo.tempo) }
  })
  function tickToSeconds(tick) {
    const segment = segments.findLast(s => s.tick <= tick) || segments[0]
    return segment.seconds + (tick - segment.tick) * segment.secondsPerTick
  }
  function secondsToTick(time) {
    const segment = segments.findLast(s => s.seconds <= time) || segments[0]
    return Math.max(0, segment.tick + (time - segment.seconds) / segment.secondsPerTick)
  }
  return { segments, offset, tickToSeconds, secondsToTick, duration: tickToSeconds(chart.maxTick) }
}
export function formatChartTime(seconds) {
  const value = Math.max(0, Number(seconds) || 0)
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
}
