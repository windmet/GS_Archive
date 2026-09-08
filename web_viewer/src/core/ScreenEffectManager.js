import * as PIXI from 'pixi.js'
import { loadEffectTexture } from './effectTextureCache.js'
import { runRafTween } from './rafTween.js'
import { tweenOverlayFade, tweenOverlayPunch } from './transitionTweens.js'

/** Owns transient screen particles, authored delays and overlay/shake tweens. */
export class ScreenEffectManager {
  constructor({ app, overlay, spineContainer, getWidth, getHeight, loadTextureFromUrl }) {
    Object.assign(this, { app, spineContainer, getWidth, getHeight })
    this._effectOverlay = overlay
    this._loadTextureFromUrl = loadTextureFromUrl
    this._screenEffectToken = 0
    this._screenEffectTimers = new Set()
    this._screenEffectCleanups = new Set()
    this._effectTextureCache = {}
  }

  get width() { return this.getWidth() }
  get height() { return this.getHeight() }

  clearScreenEffects() {
    this._screenEffectToken++
    for (const timer of this._screenEffectTimers) clearTimeout(timer)
    this._screenEffectTimers.clear()
    for (const cleanup of [...this._screenEffectCleanups]) cleanup()
    if (!this._effectOverlay || this._effectOverlay.destroyed) return
    this._effectOverlay.alpha = 0
    this._effectOverlay.visible = false
  }

  playScreenEffects(effects = [], { nowMilliseconds } = {}) {
    if (!Array.isArray(effects) || effects.length === 0 || !this._effectOverlay) return
    this.clearScreenEffects()
    const token = this._screenEffectToken
    for (const effect of effects) {
      const delayMs = Math.max(0, Number(effect?.delay || 0)) * 1000
      const dispatch = () => {
        if (token !== this._screenEffectToken) return
        if (effect?.type === 'single') this._playSingleScreenEffect(effect, nowMilliseconds)
        else this._playFadeScreenEffect(effect, nowMilliseconds)
      }
      if (nowMilliseconds) {
        this._ownScreenTween(finish => runRafTween({
          durationMs: 0, delayMs, nowMilliseconds, onUpdate: () => {},
          onComplete: () => { finish(); dispatch() },
        }))
      } else {
        const timer = setTimeout(() => { this._screenEffectTimers.delete(timer); dispatch() }, delayMs)
        this._screenEffectTimers.add(timer)
      }
    }
  }

  _playFadeScreenEffect(effect, nowMilliseconds) {
    const overlay = this._effectOverlay
    if (!overlay || overlay.destroyed) return
    const type = effect?.type || 'fadeout'
    const color = String(effect?.color || '#FFFFFF')
    overlay.tint = parseInt(color.replace('#', ''), 16)
    overlay.width = this.width
    overlay.height = this.height
    overlay.visible = true
    const maxAlpha = Math.max(0, Math.min(1, Number(effect?.alpha ?? 1)))
    const startAlpha = type === 'fadein' ? 0 : maxAlpha
    const endAlpha = type === 'fadein' ? maxAlpha : 0
    overlay.alpha = startAlpha
    const durationMs = Math.max(0, Number(effect?.duration || 0)) * 1000
    this._ownScreenTween(finish => tweenOverlayFade({
      overlay,
      token: this._screenEffectToken,
      isCurrent: token => token === this._screenEffectToken,
      durationMs,
      nowMilliseconds,
      startAlpha,
      endAlpha,
      onFinish: () => {
        if (endAlpha <= 0 && overlay && !overlay.destroyed) overlay.visible = false
        finish()
      },
    }))
  }

  _playSingleScreenEffect(effect, nowMilliseconds) {
    const id = effect?.id || ''
    if (id === 'fx_adv_punch') {
      this._playPunchEffect(effect, nowMilliseconds)
    } else if (id === 'fx_adv_kamifubuki') {
      this._playKamifubukiEffect(effect, nowMilliseconds)
    } else if (id === 'fx_adv_sakura' || id === 'fx_adv_momiji') {
      this._playFallingScreenTexture(id, effect, {}, nowMilliseconds)
    }
  }

  _playPunchEffect(effect, nowMilliseconds) {
    const overlay = this._effectOverlay
    if (!overlay || overlay.destroyed) return
    this._playPunchTexture(effect, nowMilliseconds)
    overlay.tint = 0xffffff
    overlay.width = this.width
    overlay.height = this.height
    overlay.alpha = 0.3
    overlay.visible = true
    const dir = Math.sign(Number(effect?.x || 0))
    const durationMs = Math.max(120, Number(effect?.duration || 0.35) * 1000)
    this._ownScreenTween(finish => tweenOverlayPunch({
      overlay,
      spineContainer: this.spineContainer,
      durationMs,
      dir: dir || 1,
      nowMilliseconds,
      onFinish: finish,
    }))
  }

  _loadEffectTexture(name) {
    return loadEffectTexture(this._effectTextureCache, name, url => this._loadTextureFromUrl(url))
  }

  _ownScreenEffect(display, tick) {
    const ticker = this.app.ticker
    let released = false
    const cleanup = () => {
      if (released) return
      released = true
      ticker.remove(tick)
      this._screenEffectCleanups.delete(cleanup)
      if (!display.destroyed) display.destroy({ children: true, texture: false, baseTexture: false })
    }
    this._screenEffectCleanups.add(cleanup)
    ticker.add(tick)
    return cleanup
  }

  _ownScreenTween(start) {
    let tween
    const finish = () => this._screenEffectCleanups.delete(cleanup)
    const cleanup = () => { tween?.cancel?.(); finish() }
    tween = start(finish)
    if (tween) this._screenEffectCleanups.add(cleanup)
  }

  async _playPunchTexture(effect, nowMilliseconds = () => performance.now()) {
    const token = this._screenEffectToken
    try {
      const texture = await this._loadEffectTexture('fx_adv_punch')
      if (token !== this._screenEffectToken || !this.app?.stage) return
      const frameWidth = Math.floor(texture.width / 3)
      const frameHeight = Math.floor(texture.height / 2)
      const base = texture.baseTexture
      const sprite = new PIXI.Sprite(new PIXI.Texture(base, new PIXI.Rectangle(0, 0, frameWidth, frameHeight)))
      sprite.anchor.set(0.5)
      sprite.blendMode = PIXI.BLEND_MODES.ADD
      sprite.x = this.width / 2
      sprite.y = this.height / 2
      const scale = Math.max(this.width / frameWidth, this.height / frameHeight) * 0.82
      sprite.scale.set(scale)
      sprite.alpha = 0.9
      sprite.eventMode = 'none'
      this.app.stage.addChild(sprite)

      const durationMs = Math.max(180, Number(effect?.duration || 0.35) * 1000)
      const start = nowMilliseconds()
      const tick = () => {
        if (token !== this._screenEffectToken || sprite.destroyed) {
          cleanup()
          return
        }
        const t = Math.min((nowMilliseconds() - start) / durationMs, 1)
        const frame = Math.min(5, Math.floor(t * 6))
        const fx = frame % 3
        const fy = Math.floor(frame / 3)
        sprite.texture = new PIXI.Texture(base, new PIXI.Rectangle(fx * frameWidth, fy * frameHeight, frameWidth, frameHeight))
        sprite.alpha = 1 - Math.max(0, t - 0.25) / 0.75
        sprite.scale.set(scale * (0.92 + t * 0.18))
        if (t >= 1) {
          cleanup()
        }
      }
      const cleanup = this._ownScreenEffect(sprite, tick)
    } catch (err) {
      console.warn('[PixiStageManager] Failed to load punch texture:', err?.message || err)
    }
  }

  _playKamifubukiEffect(effect, nowMilliseconds) {
    this._playFallingScreenTexture('fx_adv_sakura', effect, {
      count: 48,
      duration: Math.max(0.8, Number(effect?.duration || 1.1)),
      useStar: true,
    }, nowMilliseconds)
    this._playFadeScreenEffect({ type: 'fadein', color: '#FFFFFF', alpha: 0.18, duration: 0.1 }, nowMilliseconds)
    this._playFadeScreenEffect({ type: 'fadeout', color: '#FFFFFF', alpha: 0.18, duration: 0.28 }, nowMilliseconds)
  }

  async _playFallingScreenTexture(id, effect, options = {}, nowMilliseconds = () => performance.now()) {
    const token = this._screenEffectToken
    const textureName = id === 'fx_adv_momiji' ? 'fx_adv_momiji' : 'fx_adv_sakura'
    try {
      const textures = [await this._loadEffectTexture(textureName)]
      if (options.useStar) {
        textures.push(await this._loadEffectTexture('fx_adv_star'))
      }
      if (token !== this._screenEffectToken || !this.app?.stage) return

      const container = new PIXI.Container()
      container.eventMode = 'none'
      this.app.stage.addChild(container)
      const count = options.count || 30
      const sprites = []
      for (let i = 0; i < count; i++) {
        const texture = textures[i % textures.length]
        const sprite = new PIXI.Sprite(texture)
        sprite.anchor.set(0.5)
        sprite.alpha = 0.58 + ((i * 19) % 30) / 100
        sprite.scale.set(0.035 + ((i * 7) % 28) / 1000)
        sprite._fxInitialRotation = (i * 0.77) % Math.PI
        sprite.rotation = sprite._fxInitialRotation
        sprite._fxSeed = i * 131
        sprite._fxSpeed = 0.7 + ((i * 11) % 30) / 20
        container.addChild(sprite)
        sprites.push(sprite)
      }
      const durationMs = Math.max(300, Number(options.duration || effect?.duration || 1) * 1000)
      const start = nowMilliseconds()
      const tick = () => {
        if (token !== this._screenEffectToken || container.destroyed) {
          cleanup()
          return
        }
        const elapsed = nowMilliseconds() - start
        const progress = Math.min(elapsed / durationMs, 1)
        for (const sprite of sprites) {
          const seed = sprite._fxSeed || 0
          const drift = elapsed / 1000 * sprite._fxSpeed
          sprite.x = ((seed * 17 + drift * 260) % (this.width + 180)) - 90 + Math.sin(drift * 4 + seed) * 28
          sprite.y = ((seed * 9 + drift * 390) % (this.height + 180)) - 120
          sprite.rotation = sprite._fxInitialRotation + elapsed / 1000 * 60 * 0.035 * sprite._fxSpeed
          sprite.alpha = (0.72 - progress * 0.42) * (0.75 + ((seed % 17) / 50))
        }
        if (progress >= 1) {
          cleanup()
        }
      }
      const cleanup = this._ownScreenEffect(container, tick)
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to load screen effect "${id}":`, err?.message || err)
    }
  }

  destroy() { this.clearScreenEffects() }
}
