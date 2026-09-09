import * as PIXI from 'pixi.js'
import { BackgroundEffectManager } from './BackgroundEffectManager.js'
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
    this._bgTransition = null
    this._blurFilter = null
    this._bgBlurAmount = 0
    this._bgBlurTween = null
    this._bgColorTween = null
    this._bgOverlaySprite = null
    this._bgOverlayColor = 0xFFFFFF
    this.effects = new BackgroundEffectManager({ app, bgEffectContainer, getWidth, getHeight,
      loadTextureFromUrl: url => loadTextureFromUrl(url, { allowFallback: false }),
    })
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
    if (bgId === this.currentBgId) {
      if (Number(transition?.duration) === 0) this.settleBackgroundTransition()
      return
    }
    this.settleBackgroundTransition()
    // A request still waiting for its texture has no settled sprite. Supersede
    // it before capturing the background that a later cancellation restores.
    this.cancelBackgroundTransition()
    const oldBgId = this.currentBgId
    this.currentBgId = bgId

    const oldSprite = this.bgSprite
    const token = ++this._bgTransitionToken
    let resolveTransition
    const finished = new Promise(resolve => { resolveTransition = resolve })
    const record = {
      token,
      oldBgId,
      newBgId: bgId,
      oldSprite,
      newSprite: null,
      tickerFn: null,
      resolve: resolveTransition,
    }
    this._bgTransition = record
    try {
      const url = this.getBgUrl(bgId)
      const texture = await this.loadTextureFromUrl(url)
      if (token !== this._bgTransitionToken) return

      const newSprite = new PIXI.Sprite(texture)
      this._applyBgCover(newSprite)
      newSprite.alpha = 0
      this.bgContainer.addChild(newSprite)
      this.bgSprite = newSprite
      record.newSprite = newSprite

      const delayMs = Math.max(0, Number(transition?.delay || 0)) * 1000
      const durationSeconds = transition?.duration == null ? 0.5 : Number(transition.duration)
      const durationMs = Math.max(0, Number.isFinite(durationSeconds) ? durationSeconds : 0.5) * 1000
      // Runtime cues share the scheduler's paused/rated logical clock. Direct
      // stage callers retain wall-clock timing; loading still precedes fading.
      const nowMilliseconds = transition?.nowMilliseconds ?? (() => performance.now())
      const start = nowMilliseconds()
      record.startedAtMilliseconds = start
      const tickerFn = () => {
        if (token !== this._bgTransitionToken) {
          this.app.ticker.remove(tickerFn)
          return
        }
        const elapsed = Math.max(0, nowMilliseconds() - start)
        if (elapsed < delayMs) return
        const t = durationMs <= 0 ? 1 : Math.min((elapsed - delayMs) / durationMs, 1)
        if (oldSprite) oldSprite.alpha = 1 - t
        newSprite.alpha = t
        if (t >= 1) {
          this._finishBackgroundTransition(record, 'completed')
        }
      }
      record.tickerFn = tickerFn
      this._bgTransition = record
      if (durationMs <= 0 && delayMs <= 0) {
        this._finishBackgroundTransition(record, 'completed')
        return finished
      }
      this.app.ticker.add(tickerFn)
      return finished
    } catch (err) {
      if (token !== this._bgTransitionToken) return
      this.currentBgId = oldBgId
      this._bgTransition = null
      record.resolve?.({ status: 'failed', bgId })
      console.warn(`[PixiStageManager] Failed to load bg "${bgId}":`, err?.message || err)
    }
  }

  settleBackgroundTransition() {
    const record = this._bgTransition
    if (!record?.newSprite) return false
    this._finishBackgroundTransition(record, 'settled')
    return true
  }

  cancelBackgroundTransition() {
    const record = this._bgTransition
    if (!record) return false
    this._bgTransitionToken++
    if (record.tickerFn) this.app.ticker.remove(record.tickerFn)
    if (record.newSprite?.parent) this.bgContainer.removeChild(record.newSprite)
    record.newSprite?.destroy?.({ texture: true })
    if (record.oldSprite && !record.oldSprite.destroyed) {
      record.oldSprite.alpha = 1
      this.bgSprite = record.oldSprite
      this.currentBgId = record.oldBgId
    } else {
      this.bgSprite = null
      this.currentBgId = null
    }
    this._bgTransition = null
    record.resolve?.({ status: 'cancelled', bgId: record.newBgId })
    return true
  }

  _finishBackgroundTransition(record, status) {
    if (!record || this._bgTransition !== record) return
    if (record.tickerFn) this.app.ticker.remove(record.tickerFn)
    record.newSprite.alpha = 1
    if (record.oldSprite?.parent) {
      this.bgContainer.removeChild(record.oldSprite)
      record.oldSprite.destroy({ texture: true })
    }
    this.bgSprite = record.newSprite
    this.currentBgId = record.newBgId
    this._bgTransition = null
    record.resolve?.({ status, bgId: record.newBgId })
  }

  clearBackground() {
    this.cancelBackgroundTransition()
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

  setBgBlur(amount, duration = 0, delay = 0, nowMilliseconds) {
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
        nowMilliseconds,
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

  setBgColorOverlay(hexColor, duration = 0, delay = 0, nowMilliseconds) {
    this._bgColorTween?.cancel?.()

    if (!hexColor || (typeof hexColor === 'string' && hexColor.toUpperCase() === '#FFFFFF')) {
      if (duration > 0 && this._bgOverlaySprite && this._bgOverlaySprite.parent) {
        const durationMs = Math.max(0, Number(duration)) * 1000
        const delayMs = Math.max(0, Number(delay)) * 1000
        const startAlpha = this._bgOverlaySprite.alpha
        this._bgColorTween = runRafTween({
          nowMilliseconds,
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
        nowMilliseconds,
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

  applyBgEffects(effects = [], bgProfile = null, nowMilliseconds) {
    return this.effects?.applyBgEffects(effects, bgProfile, nowMilliseconds)
  }

  _createBgEffect(id) {
    return this.effects?._createBgEffect(id)
  }

  _drawRain(graphics, id) {
    return this.effects?._drawRain(graphics, id)
  }

  _resizeBgEffects() {
    return this.effects?._resizeBgEffects()
  }

  _bgEffectTargetAlpha(id) {
    return this.effects?._bgEffectTargetAlpha(id)
  }

  _loadCameraflareTextures() {
    return this.effects?._loadCameraflareTextures()
  }

  _animateBgEffectAlpha(entry, targetAlpha, duration = 0, delay = 0, onDone = null) {
    return this.effects?._animateBgEffectAlpha(entry, targetAlpha, duration, delay, onDone)
  }

  _removeBgEffect(id) {
    return this.effects?._removeBgEffect(id)
  }

  destroy() {
    this._bgBlurTween?.cancel?.()
    this._bgColorTween?.cancel?.()
    this._bgBlurTween = null
    this._bgColorTween = null
    this.clearBackground()
    this.clearBgBlur()
    this.clearBgColorOverlay()
    this._bgOverlaySprite?.destroy({ texture: false, baseTexture: false })
    this._bgOverlaySprite = null
    this._blurFilter?.destroy?.()
    this._blurFilter = null
    this.effects?.destroy()
    this.effects = null
  }
}
