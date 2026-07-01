import * as PIXI from 'pixi.js'
import { easeOutCubic, runRafTween } from './rafTween.js'

export class BackgroundManager {
  constructor({
    app,
    bgContainer,
    bgEffectContainer,
    getWidth,
    getHeight,
    getBgUrl,
    loadTextureFromUrl,
  }) {
    this.app = app
    this.bgContainer = bgContainer
    this.bgEffectContainer = bgEffectContainer
    this.getWidth = getWidth
    this.getHeight = getHeight
    this.getBgUrl = getBgUrl
    this.loadTextureFromUrl = loadTextureFromUrl

    this.bgSprite = null
    this.currentBgId = null

    this._bgTransitionToken = 0
    this._blurFilter = null
    this._bgBlurAmount = 0
    this._bgBlurTween = null
    this._bgColorTween = null
    this._bgOverlaySprite = null
    this._bgOverlayColor = 0xFFFFFF
    this._bgEffectEntries = {}
    this._cameraflareTextures = null
  }

  handleResize() {
    if (this.bgSprite) {
      this._applyBgCover(this.bgSprite)
    }
    if (this._bgOverlaySprite) {
      this._bgOverlaySprite.width = this.getWidth()
      this._bgOverlaySprite.height = this.getHeight()
    }
    this._resizeBgEffects()
  }

  _applyBgCover(sprite) {
    if (!sprite?.texture) return
    const width = this.getWidth()
    const height = this.getHeight()
    sprite.width = width
    sprite.height = height
    sprite.scale.x = sprite.scale.y
    sprite.anchor.set(0, 0)
    sprite.x = Math.round((width - sprite.width) / 2)
    sprite.y = 0
  }

  async setBackground(bgId, transition = null) {
    if (bgId === this.currentBgId) return
    this.currentBgId = bgId

    const oldSprite = this.bgSprite
    const token = ++this._bgTransitionToken
    try {
      const url = this.getBgUrl(bgId)
      const texture = await this.loadTextureFromUrl(url)
      if (token !== this._bgTransitionToken) return

      const newSprite = new PIXI.Sprite(texture)
      this._applyBgCover(newSprite)
      newSprite.alpha = 0
      this.bgContainer.addChild(newSprite)
      this.bgSprite = newSprite

      const delayMs = Math.max(0, Number(transition?.delay || 0)) * 1000
      const durationMs = Math.max(0.01, Number(transition?.duration || 0.5)) * 1000
      const start = performance.now()
      const tickerFn = () => {
        if (token !== this._bgTransitionToken) {
          this.app.ticker.remove(tickerFn)
          return
        }
        const elapsed = performance.now() - start
        if (elapsed < delayMs) return
        const t = Math.min((elapsed - delayMs) / durationMs, 1)
        if (oldSprite) oldSprite.alpha = 1 - t
        newSprite.alpha = t
        if (t >= 1) {
          this.app.ticker.remove(tickerFn)
          if (oldSprite?.parent) {
            this.bgContainer.removeChild(oldSprite)
            oldSprite.destroy({ texture: true })
          }
        }
      }
      this.app.ticker.add(tickerFn)
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to load bg "${bgId}":`, err?.message || err)
    }
  }

  clearBackground() {
    this._bgTransitionToken++
    this.currentBgId = null
    if (this.bgSprite) {
      if (this.bgSprite.parent) {
        this.bgContainer.removeChild(this.bgSprite)
      }
      this.bgSprite.destroy({ texture: true })
      this.bgSprite = null
    }
  }

  setBgBlur(amount, duration = 0, delay = 0) {
    const target = Math.max(0, Number(amount || 0))
    const durationMs = Math.max(0, Number(duration || 0)) * 1000
    const delayMs = Math.max(0, Number(delay || 0)) * 1000
    this._bgBlurTween?.cancel?.()
    const apply = (value) => {
      this._bgBlurAmount = value
      if (value > 0.01) {
        this._ensureBgBlurFilter()
        this._blurFilter.blur = value
      } else {
        this._bgBlurAmount = 0
        this.clearBgBlur()
      }
    }
    if (durationMs > 0 || delayMs > 0) {
      this._bgBlurTween = runRafTween({
        durationMs,
        delayMs,
        startValue: this._bgBlurAmount || 0,
        endValue: target,
        ease: easeOutCubic,
        onUpdate: apply,
      })
    } else {
      apply(target)
    }
  }

  _ensureBgBlurFilter() {
    if (!this._blurFilter) {
      this._blurFilter = new PIXI.BlurFilter()
      this._blurFilter.quality = 4
      this._blurFilter.resolution = this.app.renderer.resolution
      this._blurFilter.padding = 0
    }
    if (this.bgSprite) {
      this.bgSprite.filters = this.bgSprite.filters || []
      if (!this.bgSprite.filters.includes(this._blurFilter)) {
        this.bgSprite.filters.push(this._blurFilter)
      }
    }
  }

  setBgBlurInstant(amount) {
    const value = Math.max(0, Number(amount || 0))
    if (value > 0) {
      if (!this._blurFilter) {
        this._blurFilter = new PIXI.BlurFilter()
        this._blurFilter.quality = 4
        this._blurFilter.resolution = this.app.renderer.resolution
        this._blurFilter.padding = 0
      }
      this._blurFilter.blur = value
      this._bgBlurAmount = value
      if (this.bgSprite) {
        this.bgSprite.filters = this.bgSprite.filters || []
        if (!this.bgSprite.filters.includes(this._blurFilter)) {
          this.bgSprite.filters.push(this._blurFilter)
        }
      }
    } else {
      this.clearBgBlur()
    }
  }

  clearBgBlur() {
    this._bgBlurAmount = 0
    if (this._blurFilter && this.bgSprite?.filters) {
      this.bgSprite.filters = this.bgSprite.filters.filter(f => f !== this._blurFilter)
      if (this.bgSprite.filters.length === 0) this.bgSprite.filters = null
    }
  }

  setBgColorOverlay(hexColor, duration = 0, delay = 0) {
    this._bgColorTween?.cancel?.()

    if (!hexColor || (typeof hexColor === 'string' && hexColor.toUpperCase() === '#FFFFFF')) {
      if (duration > 0 && this._bgOverlaySprite && this._bgOverlaySprite.parent) {
        const durationMs = Math.max(0, Number(duration)) * 1000
        const delayMs = Math.max(0, Number(delay)) * 1000
        const startAlpha = this._bgOverlaySprite.alpha
        this._bgColorTween = runRafTween({
          durationMs,
          delayMs,
          startValue: startAlpha,
          endValue: 0,
          ease: t => 1 - Math.pow(1 - t, 3),
          onUpdate: (alpha) => {
            if (this._bgOverlaySprite) this._bgOverlaySprite.alpha = Math.max(0, alpha)
          },
          onComplete: () => this.clearBgColorOverlay(),
        })
      } else {
        this.clearBgColorOverlay()
      }
      return
    }

    const targetColor = parseInt(hexColor.replace('#', ''), 16)
    const durationMs = Math.max(0, Number(duration || 0)) * 1000
    const delayMs = Math.max(0, Number(delay || 0)) * 1000
    if (!this._bgOverlaySprite) {
      this._bgOverlaySprite = new PIXI.Sprite(PIXI.Texture.WHITE)
      this._bgOverlaySprite.blendMode = PIXI.BLEND_MODES.MULTIPLY
    }
    if (!this._bgOverlaySprite.parent) {
      this.bgContainer.addChild(this._bgOverlaySprite)
      this._bgOverlaySprite.tint = 0xFFFFFF
      this._bgOverlayColor = 0xFFFFFF
    }
    this._bgOverlaySprite.alpha = 0.85
    this._bgOverlaySprite.width = this.getWidth()
    this._bgOverlaySprite.height = this.getHeight()
    const startColor = this._bgOverlayColor ?? 0xFFFFFF
    const startRgb = this._hexToRgb(startColor)
    const targetRgb = this._hexToRgb(targetColor)
    const apply = (rgb) => {
      const color = this._rgbToHex(rgb)
      this._bgOverlayColor = color
      this._bgOverlaySprite.tint = color
    }
    if (durationMs > 0 || delayMs > 0) {
      this._bgColorTween = runRafTween({
        durationMs,
        delayMs,
        startValue: 0,
        endValue: 1,
        ease: easeOutCubic,
        onUpdate: (t) => {
          apply({
            r: startRgb.r + (targetRgb.r - startRgb.r) * t,
            g: startRgb.g + (targetRgb.g - startRgb.g) * t,
            b: startRgb.b + (targetRgb.b - startRgb.b) * t,
          })
        },
      })
    } else {
      apply(targetRgb)
    }
  }

  clearBgColorOverlay() {
    this._bgOverlayColor = 0xFFFFFF
    if (this._bgOverlaySprite && this._bgOverlaySprite.parent) {
      this.bgContainer.removeChild(this._bgOverlaySprite)
    }
  }

  _hexToRgb(color) {
    return { r: (color >> 16) & 255, g: (color >> 8) & 255, b: color & 255 }
  }

  _rgbToHex({ r, g, b }) {
    return ((Math.round(r) & 255) << 16) | ((Math.round(g) & 255) << 8) | (Math.round(b) & 255)
  }

  applyBgEffects(effects = []) {
    const desired = new Set()
    for (const effect of effects || []) {
      const id = effect?.id
      if (!id) continue
      desired.add(id)
      let entry = this._bgEffectEntries[id]
      if (!entry) {
        entry = this._createBgEffect(id)
        this._bgEffectEntries[id] = entry
        if (entry.container) this.bgEffectContainer.addChild(entry.container)
      }
      const ending = effect.action === 'end' || effect.visible === false
      const targetAlpha = ending ? 0 : this._bgEffectTargetAlpha(id)
      entry.container.visible = true
      this._animateBgEffectAlpha(entry, targetAlpha, effect.duration, effect.delay, () => {
        if (ending) this._removeBgEffect(id)
      })
    }

    for (const id of Object.keys(this._bgEffectEntries)) {
      if (!desired.has(id)) this._removeBgEffect(id)
    }
  }

  _createBgEffect(id) {
    const container = new PIXI.Container()
    container.eventMode = 'none'
    container.alpha = 0
    const entry = { id, container, ticker: null, graphics: [] }

    if (id === 'cameraflare') {
      console.warn('[PixiStageManager] cameraflare disabled')
    } else if (id.startsWith('fx_adv_rain')) {
      const rain = new PIXI.Graphics()
      this._drawRain(rain, id)
      container.addChild(rain)
      entry.graphics.push(rain)
      const speed = id.includes('heavy') ? 9 : 5
      entry.ticker = () => {
        rain.y += speed
        if (rain.y > 28) rain.y = 0
      }
      this.app.ticker.add(entry.ticker)
    }

    return entry
  }

  _drawRain(graphics, id) {
    graphics.clear()
    const heavy = id.includes('heavy')
    const count = heavy ? 150 : 80
    graphics.lineStyle(heavy ? 2 : 1, 0xcfe9ff, heavy ? 0.36 : 0.28)
    for (let i = 0; i < count; i++) {
      const x = (i * 97) % Math.max(1, this.getWidth() + 80) - 40
      const y = (i * 53) % Math.max(1, this.getHeight() + 60) - 60
      graphics.moveTo(x, y)
      graphics.lineTo(x - 18, y + (heavy ? 42 : 32))
    }
  }

  _resizeBgEffects() {
    for (const entry of Object.values(this._bgEffectEntries)) {
      if (!entry?.graphics?.length) continue
      if (entry.id === 'cameraflare') {
        // no-op
      } else if (entry.id.startsWith('fx_adv_rain')) {
        this._drawRain(entry.graphics[0], entry.id)
      }
    }
  }

  _bgEffectTargetAlpha(id) {
    if (id === 'cameraflare') return 0.85
    if (id.startsWith('fx_adv_rain')) return 0.85
    return 0
  }

  _loadCameraflareTextures() {
    if (this._cameraflareTextures) return this._cameraflareTextures
    const urls = [0, 1, 2, 3].map(i => `/data/fx_extracted/shine_frame_${i}.png`)
    this._cameraflareTextures = Promise.all(urls.map(url => this.loadTextureFromUrl(url)))
      .catch(e => {
        this._cameraflareTextures = null
        throw e
      })
    return this._cameraflareTextures
  }

  _animateBgEffectAlpha(entry, targetAlpha, duration = 0, delay = 0, onDone = null) {
    if (!entry?.container) return
    const token = (entry.token || 0) + 1
    entry.token = token
    const startAlpha = entry.container.alpha
    const delayMs = Math.max(0, Number(delay || 0)) * 1000
    const durationMs = Math.max(0, Number(duration || 0)) * 1000
    const t0 = performance.now()
    const tick = () => {
      if (entry.token !== token || !entry.container || entry.container.destroyed) return
      const elapsed = performance.now() - t0
      if (elapsed < delayMs) {
        requestAnimationFrame(tick)
        return
      }
      const t = durationMs <= 0 ? 1 : Math.min((elapsed - delayMs) / durationMs, 1)
      entry.container.alpha = startAlpha + (targetAlpha - startAlpha) * t
      if (t >= 1) {
        entry.container.visible = targetAlpha > 0
        if (onDone) onDone()
      } else {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
  }

  _removeBgEffect(id) {
    const entry = this._bgEffectEntries[id]
    if (!entry) return
    entry.token = (entry.token || 0) + 1
    if (entry.ticker) this.app.ticker.remove(entry.ticker)
    if (entry.container?.parent) entry.container.parent.removeChild(entry.container)
    entry.container?.destroy({ children: true })
    delete this._bgEffectEntries[id]
  }

  destroy() {
    this._bgBlurTween?.cancel?.()
    this._bgColorTween?.cancel?.()
    this.clearBackground()
    this.clearBgBlur()
    this.clearBgColorOverlay()
    for (const id of Object.keys(this._bgEffectEntries)) {
      this._removeBgEffect(id)
    }
    this._bgEffectEntries = {}
  }
}
