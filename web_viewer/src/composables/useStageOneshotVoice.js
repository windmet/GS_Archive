import { computed, ref, watch } from 'vue'

// Songs such as FLASH LIGHT and precious love leave a gap in the mix for one line.
// The client's Unit_serif effect fills it with the oneshot cue of the deck card in
// slot value1 (1 = center); see scripts/prepare-song-oneshot-voices.py for the RVAs.
export const ONESHOT_MANIFEST_URL = '/data/song_oneshot_voices.json'
export const ONESHOT_CENTER = 'center'
export const ONESHOT_OFF = 'off'

let manifestRequest = null

export function validateOneshotManifest(manifest) {
  if (manifest?.schema_version !== 1 || !manifest.songs || typeof manifest.songs !== 'object') {
    throw new Error('oneshot manifest: unsupported schema')
  }
  for (const [code, song] of Object.entries(manifest.songs)) {
    if (!Array.isArray(song.triggers) || !song.triggers.length) throw new Error(`oneshot manifest: ${code} has no triggers`)
    for (const trigger of song.triggers) {
      if (!Number.isFinite(trigger.time_ms) || !Number.isInteger(trigger.deck_slot) || trigger.deck_slot < 1) {
        throw new Error(`oneshot manifest: ${code} trigger is malformed`)
      }
    }
    for (const [idol, clip] of Object.entries(song.clips || {})) {
      if (typeof clip.url !== 'string' || !(clip.duration_seconds > 0)) throw new Error(`oneshot manifest: ${code}/${idol} clip is malformed`)
    }
  }
  return manifest
}

function loadOneshotManifest() {
  manifestRequest ||= Promise.resolve()
    .then(() => fetch(ONESHOT_MANIFEST_URL))
    .then(response => {
      if (!response.ok) throw new Error(`oneshot manifest HTTP ${response.status}`)
      return response.json()
    })
    .then(validateOneshotManifest)
    .catch(error => {
      manifestRequest = null
      throw error
    })
  return manifestRequest
}

/** First trigger whose clip has not finished by `timeMs`. */
export function oneshotCursorAt(triggers, timeMs, durationMs) {
  const index = triggers.findIndex(trigger => trigger.time_ms + durationMs > timeMs)
  return index < 0 ? triggers.length : index
}

export function resolveOneshotIdol(selection, centerIdolCode, clips) {
  if (selection === ONESHOT_OFF) return ''
  const idol = selection === ONESHOT_CENTER ? centerIdolCode : selection
  return idol && clips?.[idol] ? idol : ''
}

export function useStageOneshotVoice({ songCode, centerIdolCode, playbackRate }) {
  const manifest = ref(null)
  const error = ref('')
  const selection = ref(ONESHOT_CENTER)
  let audio = null
  let audioIdol = ''
  let cursor = 0
  let volume = 1

  const entry = computed(() => manifest.value?.songs?.[songCode.value] || null)
  const available = computed(() => Boolean(entry.value))
  const triggers = computed(() => entry.value?.triggers || [])
  const idolCodes = computed(() => Object.keys(entry.value?.clips || {}))
  const resolvedIdolCode = computed(() => resolveOneshotIdol(selection.value, centerIdolCode.value, entry.value?.clips))
  const clip = computed(() => resolvedIdolCode.value ? entry.value.clips[resolvedIdolCode.value] : null)
  const durationMs = computed(() => (clip.value?.duration_seconds || 0) * 1000)

  function releaseClip() {
    if (!audio) return
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    audio = null
    audioIdol = ''
  }

  function ensureClip() {
    if (!clip.value) { releaseClip(); return null }
    if (audio && audioIdol === resolvedIdolCode.value) return audio
    releaseClip()
    audio = new Audio(clip.value.url)
    audio.preload = 'auto'
    audio.playbackRate = playbackRate.value
    audio.volume = volume
    audioIdol = resolvedIdolCode.value
    audio.load()
    return audio
  }

  function stop() {
    audio?.pause()
  }

  /** Call when playback (re)starts at `timeMs`; a clip already under way resumes mid-line. */
  function start(timeMs) {
    cursor = oneshotCursorAt(triggers.value, timeMs, durationMs.value)
  }

  /** Call once per stage frame while playing. */
  function update(timeMs) {
    const list = triggers.value
    while (cursor < list.length && list[cursor].time_ms <= timeMs) {
      const offset = (timeMs - list[cursor].time_ms) / 1000
      cursor += 1
      const element = ensureClip()
      if (!element || offset * 1000 >= durationMs.value) continue
      element.playbackRate = playbackRate.value
      element.currentTime = offset
      Promise.resolve(element.play()).catch(playError => {
        if (element === audio) error.value = `台词音轨无法播放：${playError.message || playError}`
      })
    }
  }

  function setPlaybackRate(rate) {
    if (audio) audio.playbackRate = rate
  }

  function setVolume(value) {
    volume = Math.min(1, Math.max(0, Number(value) || 0))
    if (audio) audio.volume = volume
  }

  watch(songCode, () => {
    selection.value = ONESHOT_CENTER
    releaseClip()
    cursor = 0
  })
  // Preload the chosen line so the first trigger is not late; a new choice mid-line stops the old one.
  watch([resolvedIdolCode, available], () => {
    if (audioIdol !== resolvedIdolCode.value) releaseClip()
    if (available.value) ensureClip()
  })

  loadOneshotManifest()
    .then(value => { manifest.value = value })
    .catch(loadError => { console.warn('[ChibiStage] oneshot manifest unavailable', loadError) })

  return {
    available,
    entry,
    error,
    idolCodes,
    resolvedIdolCode,
    selection,
    triggers,
    release: releaseClip,
    setPlaybackRate,
    setVolume,
    start,
    stop,
    update,
  }
}
