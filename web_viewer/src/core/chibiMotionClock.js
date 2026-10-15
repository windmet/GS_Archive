const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)

export function validateMotionClock(data, choreographyHash, songs) {
  if (data?.schemaVersion !== 1 || data.ticksPerBeat !== 480 || data.clock !== 'native-live-seconds'
      || !digest(choreographyHash) || data.choreographyIndexSha256 !== choreographyHash)
    throw new Error('Native motion clock does not match choreography')
  if (!data.tracks || !data.songs || Object.keys(data.songs).length !== songs.length)
    throw new Error('Native motion clock arrangement count mismatch')
  for (const song of songs) {
    const binding = data.songs[song.id], track = data.tracks[song.songCode]
    if (!binding || binding.source !== song.source || binding.songCode !== song.songCode
        || !track || track.raw?.bundle !== `song_${song.songCode}.unity3d`
        || track.raw?.textAsset !== `${song.songCode}_fumen`
        || !digest(track.raw?.bundleSha256) || !digest(track.raw?.textSha256)
        || !Number.isFinite(track.bgmOffsetSeconds) || !Array.isArray(track.tempos) || !track.tempos.length)
      throw new Error('Invalid native motion clock identity/source')
    let previous = null
    for (const row of track.tempos) {
      if (!Number.isSafeInteger(row.tick) || row.tick < 0 || !Number.isFinite(row.timeMs)
          || !Number.isFinite(row.bpm) || row.bpm <= 0
          || !previous && (row.tick !== 0 || row.timeMs !== 0)
          || previous && (row.tick < previous.tick || Math.abs(row.timeMs - previous.timeMs
            - (row.tick - previous.tick)*60/(480*previous.bpm)*1000) > 1e-7))
        throw new Error('Invalid native conductor segment/order')
      previous = row
    }
  }
  return data
}

export function motionClockForSong(data, song) {
  const binding = data?.songs?.[song?.id]
  if (!song || !binding || binding.source !== song.source || binding.songCode !== song.songCode) return null
  return data.tracks[song.songCode]
}

// NoteManager.ConductorStep compares currentTime >= conductor.absTime;
// SetNoteObj already supplies the initial tempo during the negative prelude.
export function nativeMotionTempoAt(track, timeMs) {
  if (!track || !Number.isFinite(timeMs)) throw new Error('Native motion tempo unavailable')
  return (track.tempos.findLast(row => row.timeMs <= timeMs) || track.tempos[0]).bpm
}

// IL2CPP reads curTempo as float, then performs single-precision operations.
// PlayMotionInner/callback assign the result once; a later tempo change does
// not rescale an already-running motion.
export function nativeMotionSpeed(track, event) {
  const tempo = Math.fround(nativeMotionTempoAt(track, Number(event.time)))
  const rawSpeed = Number(event.speed ?? 1000)
  if (!Number.isFinite(rawSpeed) || rawSpeed < 0) throw new Error('Invalid native motion command speed')
  const base = Math.fround(1.5 / Math.fround(Math.fround(60 / tempo) * 4))
  return Math.fround(base * Math.fround(rawSpeed / 1000))
}

export function nativeMotionMixWindowMs(track, event) {
  if (Number(event.mode) === 3) return 0
  const speed = nativeMotionSpeed(track, event)
  return speed > 0 ? 150 / speed : Infinity
}

// LiveSoundDirector.UpdateCurrentTime: offset + (audioMs-deviceDelayMs)/1000.
// The archive has no original device calibration; media time uses delay=0.
export function nativeStageAudioOffsetMs(track) {
  if (!Number.isFinite(track?.bgmOffsetSeconds)) throw new Error('Native audio clock unavailable')
  return Math.fround(track.bgmOffsetSeconds) * 1000
}

export function nativeStageTimeFromAudio(track, seconds) {
  return seconds * 1000 + nativeStageAudioOffsetMs(track)
}

export function nativeStageAudioTime(track, milliseconds) {
  return Math.max(0, (milliseconds - nativeStageAudioOffsetMs(track)) / 1000)
}

// This viewer starts with the audio, rather than the game's negative prelude.
// A seek before the media origin must resolve to the pose at audio sample zero.
export function nativeStageAudioStartTime(track, milliseconds) {
  return Math.max(0, milliseconds, nativeStageAudioOffsetMs(track))
}

export function nativeSingerEventsForAudio(track, events) {
  const offset = nativeStageAudioOffsetMs(track)
  return events.map(event => ({ ...event, time: event.time - offset }))
}
