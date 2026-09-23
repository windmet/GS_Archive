// Use the same millisecond clock as ChibiStageViewer. No inferred alignment.
export function authoredSongLyrics(timeline, songCode) {
  if (timeline?.songCode !== songCode || timeline?.timeUnit !== 'ms') return []
  const events = (timeline.lyricEvents || []).map((event, index) => ({
    index, time: Number(event.time), duration: Number(event.duration), text: event.text?.trim() || '',
  })).filter(event => Number.isFinite(event.time)).sort((a, b) => a.time - b.time || a.index - b.index)
  return events.map((event, index) => ({ ...event,
    end: Math.min(event.time + Math.max(0, event.duration || 0), events[index + 1]?.time ?? Infinity),
  })).filter(event => event.text)
}

export function activeSongLyric(lines, seconds) {
  if (!Number.isFinite(seconds)) return null
  const time = seconds * 1000
  return [...lines].reverse().find(line => line.time <= time && time < line.end)?.index ?? null
}

export function sharesSongAudio(timeline, songCode, audioUrl) {
  return Boolean(timeline?.songCode === songCode && audioUrl && timeline.audioRef?.url === audioUrl)
}
