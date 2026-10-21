import * as PIXI from 'pixi.js'
import { BackgroundEffectManager } from './BackgroundEffectManager.js'
import { runRafTween } from './rafTween.js'
import { backgroundPanelRect } from '../../shared/story/AdvStageLayout.js'
import {
  backgroundBlurAlpha,
  backgroundBlurTarget,
  backgroundColorValue,
  cameraBlurAlpha,
  gaussianBlurFragment,
  lerpBackgroundColor,
} from '../../shared/story/BackgroundBlur.js'

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
    this._blurPasses = null
    // _bgBlurAmount is the SetOffsetBlur value, _bgOffsetBlur its last completed target and _bgBlurAlpha
    // the CanvasGroup alpha last written by either the offset blur or a camera move.
    this._bgBlurAmount = 0
    this._bgOffsetBlur = 0
    this._bgBlurTarget = 0
    this._bgBlurAlpha = 0
    this._bgBlurTween = null
    this._bgColor = 0xFFFFFF
    this._bgColorTarget = 0xFFFFFF
    this._bgColorTween = null
    this.effects = new BackgroundEffectManager({ app, bgEffectContainer, getWidth, getHeight,
      loadTextureFromUrl: url => loadTextureFromUrl(url, { allowFallback: false }),
    })
  }

  handleResize() {
    if (this.bgSprite) {
      this._applyBgCover(this.bgSprite)
    }
    this._resizeBgEffects()
  }

  // AdventureBackgroundPanel: the 1800x960 panel at orthographicSize / 5, centred on the view (4/3 of the
  // view height); its Image stretches any sprite to the panel rect.
  _applyBgCover(sprite) {
    if (!sprite?.texture) return
    const rect = backgroundPanelRect(this.getWidth(), this.getHeight())
    sprite.anchor.set(0, 0)
    sprite.width = rect.width
    sprite.height = rect.height
    sprite.x = rect.x
    sprite.y = rect.y
  }

  async setBackground(bgId, transition = null) {
    if (bgId === this.currentBgId) {
      const pending = this._bgTransition
      if (Number(transition?.duration) === 0) {
        if (pending && !pending.newSprite) pending.settleOnLoad = true
        this.settleBackgroundTransition()
      }
      // currentBgId is assigned before loading. Repeated callers must await
      // the same texture/transition instead of reporting an unfinished scene.
      return pending?.finished ?? { status: 'completed', bgId }
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
      finished,
      settleOnLoad: false,
      controller: new AbortController(),
    }
    this._bgTransition = record
    try {
      const url = this.getBgUrl(bgId)
      // A placeholder texture cannot satisfy the player's entry-background
      // readiness gate. Let missing/invalid images reach its blocked state.
      const texture = await this.loadTextureFromUrl(url, { allowFallback: false, signal: record.controller.signal })
      if (token !== this._bgTransitionToken) return finished

      const newSprite = new PIXI.Sprite(texture)
      this._applyBgCover(newSprite)
      newSprite.alpha = 0
      newSprite.tint = this._bgColor
      this.bgContainer.addChild(newSprite)
      this.bgSprite = newSprite
      record.newSprite = newSprite
      this._syncBlurLayer(newSprite)

      const delayMs = record.settleOnLoad ? 0 : Math.max(0, Number(transition?.delay || 0)) * 1000
      const durationSeconds = record.settleOnLoad ? 0 : transition?.duration == null ? 0.5 : Number(transition.duration)
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
      if (token !== this._bgTransitionToken) return finished
      this.currentBgId = oldBgId
      this._bgTransition = null
      record.resolve?.({ status: 'failed', bgId })
      console.warn(`[PixiStageManager] Failed to load bg "${bgId}":`, err?.message || err)
      return finished
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
    record.controller?.abort()
    if (record.tickerFn) this.app.ticker.remove(record.tickerFn)
    this._destroyBgSprite(record.newSprite)
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
    if (record.oldSprite?.parent) this._destroyBgSprite(record.oldSprite)
    this.bgSprite = record.newSprite
    this.currentBgId = record.newBgId
    this._bgTransition = null
    record.resolve?.({ status, bgId: record.newBgId })
  }

  clearBackground() {
    this.cancelBackgroundTransition()
    this._bgTransitionToken++
    this.currentBgId = null
    this._destroyBgSprite(this.bgSprite)
    this.bgSprite = null
  }

  /** image_bg_dof: SetOffsetBlur lerps linearly from the previous amount target after the delay. */
  setBgBlur(amount, duration = 0, delay = 0, nowMilliseconds) {
    const target = backgroundBlurTarget(amount)
    const durationMs = Math.max(0, Number(duration) || 0) * 1000
    const delayMs = Math.max(0, Number(delay) || 0) * 1000
    // Cumulative snapshots repeat the settled amount; only a new command restarts SetOffsetBlur, so a
    // camera-written alpha survives until then.
    if (target === this._bgBlurTarget && durationMs === 0 && delayMs === 0) return
    this._bgBlurTween?.cancel?.()
    this._bgBlurTween = null
    this._bgBlurTarget = target
    const from = this._bgOffsetBlur
    const finish = () => {
      this._bgOffsetBlur = target
      this._setOffsetBlur(target)
    }
    if (durationMs === 0 && delayMs === 0) {
      finish()
      return
    }
    this._bgBlurTween = runRafTween({
      nowMilliseconds,
      durationMs,
      delayMs,
      startValue: from,
      endValue: target,
      ease: t => t,
      onUpdate: value => this._setOffsetBlur(value),
      // The finished handle stays readable for the projector shadow's origin check.
      onComplete: finish,
    })
  }

  /** StoryCamera.BlurBackGround: a camera move frame overwrites the blur alpha. */
  setCameraBlur(zoom) {
    this._setBlurAlpha(cameraBlurAlpha(zoom))
  }

  clearBgBlur() {
    this._bgBlurTween?.cancel?.()
    this._bgBlurTween = null
    this._bgBlurTarget = 0
    this._bgOffsetBlur = 0
    this._setOffsetBlur(0)
  }

  _setOffsetBlur(value) {
    this._bgBlurAmount = value
    this._setBlurAlpha(backgroundBlurAlpha(value))
  }

  _setBlurAlpha(alpha) {
    this._bgBlurAlpha = alpha
    for (const sprite of this._backgroundSprites()) this._syncBlurLayer(sprite)
  }

  _backgroundSprites() {
    const record = this._bgTransition
    return [...new Set([this.bgSprite, record?.oldSprite, record?.newSprite])].filter(sprite => sprite && !sprite.destroyed)
  }

  // The blurred image is created on first use and lives as a child of its sharp sprite, so the cover
  // geometry, cross-fade and disposal follow the background.
  _syncBlurLayer(sprite) {
    let layer = sprite._nativeBlurLayer
    if (!layer && this._bgBlurAlpha > 0) {
      const texture = this._createBlurTexture(sprite.texture)
      if (!texture) return
      layer = new PIXI.Sprite(texture)
      layer.width = sprite.texture.width
      layer.height = sprite.texture.height
      sprite.addChild(layer)
      sprite._nativeBlurLayer = layer
    }
    if (!layer) return
    layer.alpha = this._bgBlurAlpha
    layer.visible = this._bgBlurAlpha > 0
    layer.tint = this._bgColor
  }

  _createBlurTexture(texture) {
    const renderer = this.app?.renderer
    if (!renderer || !texture?.valid) return null
    const width = Math.floor(texture.width), height = Math.floor(texture.height)
    if (!this._blurPasses) {
      const fragment = gaussianBlurFragment()
      this._blurPasses = [[1, 0], [0, 1]].map(direction => {
        const pass = new PIXI.Filter(undefined, fragment, { uDirection: new Float32Array(direction) })
        pass.resolution = 1
        pass.padding = 0
        return pass
      })
    }
    const source = new PIXI.Sprite(texture)
    source.width = width
    source.height = height
    source.filters = this._blurPasses
    source.filterArea = new PIXI.Rectangle(0, 0, width, height)
    const output = PIXI.RenderTexture.create({ width, height, resolution: 1 })
    renderer.render(source, { renderTexture: output, clear: true })
    source.filters = null
    source.destroy()
    return output
  }

  _destroyBgSprite(sprite) {
    if (!sprite || sprite.destroyed) return
    if (sprite.parent) sprite.parent.removeChild(sprite)
    sprite._nativeBlurLayer?.destroy({ texture: true, baseTexture: true })
    sprite._nativeBlurLayer = null
    sprite.destroy({ texture: true })
  }

  /** image_bg_color: Color.Lerp of both images from the current colour after the delay. */
  setBgColor(hexColor, duration = 0, delay = 0, nowMilliseconds) {
    const target = backgroundColorValue(hexColor) ?? 0xFFFFFF
    const durationMs = Math.max(0, Number(duration) || 0) * 1000
    const delayMs = Math.max(0, Number(delay) || 0) * 1000
    if (target === this._bgColorTarget && durationMs === 0 && delayMs === 0) return
    this._bgColorTween?.cancel?.()
    this._bgColorTween = null
    this._bgColorTarget = target
    if (durationMs === 0 && delayMs === 0) {
      this._applyBgColor(target)
      return
    }
    const from = this._bgColor
    this._bgColorTween = runRafTween({
      nowMilliseconds,
      durationMs,
      delayMs,
      ease: t => t,
      onUpdate: t => this._applyBgColor(lerpBackgroundColor(from, target, t)),
    })
  }

  clearBgColor() {
    this._bgColorTween?.cancel?.()
    this._bgColorTween = null
    this._bgColorTarget = 0xFFFFFF
    this._applyBgColor(0xFFFFFF)
  }

  _applyBgColor(color) {
    this._bgColor = color
    for (const sprite of this._backgroundSprites()) {
      sprite.tint = color
      if (sprite._nativeBlurLayer) sprite._nativeBlurLayer.tint = color
    }
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
    this.clearBgColor()
    this._blurPasses?.forEach(pass => pass.destroy())
    this._blurPasses = null
    this.effects?.destroy()
    this.effects = null
  }
}
