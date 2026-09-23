import * as PIXI from 'pixi.js'

/** Browser image decoding followed by Pixi readiness, with one terminal cleanup. */
export function loadImageTexture(url, {
  allowFallback = true, fallbackTexture,
  createImage = () => new Image(),
  createBaseTexture = image => PIXI.BaseTexture.from(image),
  createTexture = base => PIXI.Texture.from(base),
  setTimer = setTimeout, clearTimer = clearTimeout,
} = {}) {
  return new Promise((resolve, reject) => {
    const image = createImage()
    let base, timer = null, settled = false
    const finish = (value, error) => {
      if (settled) return
      settled = true
      image.onload = image.onerror = null
      if (timer != null) clearTimer(timer)
      timer = null
      base?.off?.('update', onReady)
      if (error) reject(error)
      else resolve(value)
    }
    const resolveTexture = () => {
      try { finish(createTexture(base)) } catch (error) { finish(null, error) }
    }
    const onReady = () => {
      if (!settled && base.valid) resolveTexture()
    }
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (settled) return
      try {
        base = createBaseTexture(image)
        base.alphaMode = PIXI.ALPHA_MODES.PMA
        if (base.valid) onReady()
        else {
          base.on('update', onReady)
          timer = setTimer(() => {
            if (settled) return
            if (!base.valid) console.warn(`[PixiStageManager] Texture timeout: ${url}`)
            if (base.valid || allowFallback) resolveTexture()
            else finish(null, new Error(`Texture timeout: ${url}`))
          }, 10000)
        }
      } catch (error) { finish(null, error) }
    }
    image.onerror = () => {
      if (settled) return
      console.warn(`[PixiStageManager] Failed to load texture: ${url}`)
      try {
        if (allowFallback) finish(fallbackTexture())
        else finish(null, new Error(`Failed to load texture: ${url}`))
      } catch (error) { finish(null, error) }
    }
    try { image.src = url } catch (error) { finish(null, error) }
  })
}
