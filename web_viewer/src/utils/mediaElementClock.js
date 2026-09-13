const EVENTS = [
  'loadstart', 'loadedmetadata', 'durationchange', 'timeupdate', 'play', 'playing',
  'pause', 'waiting', 'stalled', 'canplay', 'seeking', 'seeked', 'ratechange',
  'ended', 'error', 'emptied',
]

const emptySnapshot = () => ({
  phase: 'idle', currentTime: 0, duration: null, playbackRate: 1, errorCode: null,
})

function positiveTime(value) {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

export function createMediaElementClock(onChange = () => {}) {
  let element = null
  let waiting = false
  let snapshot = emptySnapshot()

  function publish(eventType = '') {
    if (!element) {
      snapshot = emptySnapshot()
    } else {
      if (['playing', 'canplay', 'seeked', 'pause', 'ended', 'emptied'].includes(eventType)) waiting = false
      if (['waiting', 'stalled'].includes(eventType)) waiting = true
      const errorCode = element.error?.code || null
      const phase = errorCode ? 'error'
        : element.ended ? 'ended'
          : element.seeking ? 'seeking'
            : !element.paused && (waiting || element.readyState < 3) ? 'waiting'
              : !element.paused ? 'playing'
                : element.readyState >= 1 ? 'ready' : 'loading'
      snapshot = {
        phase,
        currentTime: positiveTime(element.currentTime),
        duration: Number.isFinite(element.duration) ? positiveTime(element.duration) : null,
        playbackRate: Number.isFinite(element.playbackRate) && element.playbackRate > 0 ? element.playbackRate : 1,
        errorCode,
      }
    }
    onChange(snapshot)
  }

  const handleEvent = event => publish(event.type)

  function bind(nextElement) {
    if (element === nextElement) return
    if (element) for (const name of EVENTS) element.removeEventListener(name, handleEvent)
    element = nextElement || null
    waiting = false
    if (element) for (const name of EVENTS) element.addEventListener(name, handleEvent)
    publish()
  }

  function seek(seconds) {
    if (!element || !Number.isFinite(seconds)) return false
    const maximum = Number.isFinite(element.duration) ? positiveTime(element.duration) : Infinity
    try {
      element.currentTime = Math.min(maximum, positiveTime(seconds))
      publish('seeking')
      return true
    } catch {
      return false
    }
  }

  return {
    bind,
    seek,
    getSnapshot: () => snapshot,
    dispose: () => bind(null),
  }
}
