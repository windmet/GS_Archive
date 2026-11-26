import { onBeforeUnmount, ref, toValue, watch } from 'vue'

const prefetchedUrls = new Set()
const MAX_PREFETCH_CACHE = 64

function isReducedMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

export function preloadImage(src) {
  return new Promise(resolve => {
    if (typeof Image !== 'function' || !src) {
      resolve(true)
      return
    }
    const probe = new Image()
    probe.decoding = 'async'
    probe.src = src
    if (probe.complete) {
      if (probe.naturalWidth > 0 && typeof probe.decode === 'function') {
        probe.decode().then(() => resolve(true), () => resolve(true))
      } else {
        resolve(probe.naturalWidth > 0)
      }
      return
    }
    const done = ok => {
      probe.onload = null
      probe.onerror = null
      if (ok && typeof probe.decode === 'function') {
        probe.decode().then(() => resolve(true), () => resolve(true))
      } else {
        resolve(ok)
      }
    }
    probe.onload = () => done(true)
    probe.onerror = () => done(false)
  })
}

// Keep the current image visible while the next URL downloads and decodes off-DOM, then crossfade
// cleanly instead of destroying the <img> and flashing the grey placeholder surface underneath.
export function useSmoothImage(source, { fadeMs = 180 } = {}) {
  const initial = toValue(source) || ''
  const displaySrc = ref(initial)
  const overlaySrc = ref('')
  const pending = ref(false)
  let seq = 0
  let promoteTimer = 0

  function clearPromote() {
    if (promoteTimer) {
      clearTimeout(promoteTimer)
      promoteTimer = 0
    }
  }

  watch(() => toValue(source) || '', async next => {
    const token = ++seq
    clearPromote()
    if (!next) {
      displaySrc.value = ''
      overlaySrc.value = ''
      pending.value = false
      return
    }
    // First paint or identical URL: bind immediately so initial LCP is never delayed.
    if (!displaySrc.value || displaySrc.value === next) {
      displaySrc.value = next
      overlaySrc.value = ''
      pending.value = false
      return
    }
    // If an earlier transition was still fading, promote it so the base never jumps backwards.
    if (overlaySrc.value) {
      displaySrc.value = overlaySrc.value
      overlaySrc.value = ''
    }
    if (displaySrc.value === next) {
      pending.value = false
      return
    }
    pending.value = true
    await preloadImage(next)
    if (token !== seq) return
    pending.value = false
    if (isReducedMotion() || fadeMs <= 0) {
      displaySrc.value = next
      overlaySrc.value = ''
      return
    }
    overlaySrc.value = next
    promoteTimer = setTimeout(() => {
      promoteTimer = 0
      if (token !== seq) return
      displaySrc.value = next
      overlaySrc.value = ''
    }, fadeMs + 20)
  })

  onBeforeUnmount(() => {
    seq += 1
    clearPromote()
  })

  return { displaySrc, overlaySrc, pending }
}

// Warm alternate card/portrait URLs during idle time so toggling normal <-> awakened is instant.
export function scheduleImagePrefetch(urls = []) {
  if (typeof Image !== 'function') return () => {}
  if (globalThis.navigator?.connection?.saveData) return () => {}
  const list = [...new Set(urls.filter(url => url && !prefetchedUrls.has(url)))]
  if (!list.length) return () => {}
  let cancelled = false
  const run = () => {
    if (cancelled) return
    for (const url of list) {
      if (prefetchedUrls.size >= MAX_PREFETCH_CACHE) {
        const oldest = prefetchedUrls.values().next().value
        if (oldest) prefetchedUrls.delete(oldest)
      }
      prefetchedUrls.add(url)
      const img = new Image()
      img.decoding = 'async'
      img.src = url
    }
  }
  if (typeof globalThis.requestIdleCallback === 'function') {
    const id = globalThis.requestIdleCallback(run, { timeout: 1200 })
    return () => { cancelled = true; globalThis.cancelIdleCallback?.(id) }
  }
  const timer = setTimeout(run, 320)
  return () => { cancelled = true; clearTimeout(timer) }
}
