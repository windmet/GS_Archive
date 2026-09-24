import * as PIXI from 'pixi.js'
import { createLoadTimeout } from './AsyncLoadBoundary.js'

/** Separate browser image load from GPU/base-texture readiness. PMA is unchanged. */
export function loadImageTexture(url, {
  allowFallback = true, fallbackTexture,
  createImage = () => new Image(),
  createBaseTexture = image => PIXI.BaseTexture.from(image),
  createTexture = base => PIXI.Texture.from(base),
  setTimer = setTimeout, clearTimer = clearTimeout,
  signal, networkTimeoutMs = 25000, textureTimeoutMs = 10000,
} = {}) {
  return new Promise((resolve, reject) => {
    const image = createImage()
    let base, timer = null, settled = false
    const clearDeadline = () => {
      if (timer != null) clearTimer(timer)
      timer = null
    }
    const finish = (value, error) => {
      if (settled) return
      settled = true
      image.onload = image.onerror = image.onabort = null
      signal?.removeEventListener('abort', onAbort)
      clearDeadline()
      base?.off?.('update', onReady)
      if (error) reject(error)
      else resolve(value)
    }
    const fail = error => {
      if (settled) return
      // Abandon our image request, but never destroy a shared Pixi base texture here.
      image.onload = image.onerror = image.onabort = null
      image.removeAttribute?.('src')
      finish(null, error)
    }
    const onAbort = () => fail(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    const onReady = () => {
      if (!settled && base?.valid) {
        try { finish(createTexture(base)) } catch (error) { fail(error) }
      }
    }
    if (signal?.aborted) { onAbort(); return }
    signal?.addEventListener('abort', onAbort, { once: true })
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (settled) return
      clearDeadline()
      try {
        base = createBaseTexture(image)
        base.alphaMode = PIXI.ALPHA_MODES.PMA
        if (base.valid) onReady()
        else {
          base.on('update', onReady)
          timer = setTimer(() => {
            if (settled) return
            if (base.valid) onReady()
            else fail(createLoadTimeout(`texture-ready ${url}`, textureTimeoutMs))
          }, textureTimeoutMs)
        }
      } catch (error) { fail(error) }
    }
    image.onerror = () => {
      if (settled) return
      const error = Object.assign(new Error(`Image load failed: ${url}`), { code: 'IMAGE_LOAD_FAILED', phase: 'image' })
      // Only explicit image-error fallback is preserved. A timeout is never ready.
      if (allowFallback && typeof fallbackTexture === 'function') {
        try { finish(fallbackTexture()) } catch (failure) { fail(failure) }
      } else fail(error)
    }
    image.onabort = () => fail(new DOMException('Image request aborted', 'AbortError'))
    timer = setTimer(() => fail(createLoadTimeout(`image-network ${url}`, networkTimeoutMs)), networkTimeoutMs)
    try { image.src = url } catch (error) { fail(error) }
  })
}
