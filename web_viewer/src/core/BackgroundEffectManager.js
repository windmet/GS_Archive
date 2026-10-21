import * as PIXI from 'pixi.js'
import { loadEffectTexture } from './effectTextureCache.js'
import { runRafTween } from './rafTween.js'
import { advParticleEffectAlpha, advParticleLifetime, advParticlePrefab, advParticleSystems, sampleAdvParticles } from './advParticleEffects.js'

const ADV_PARTICLE_EFFECT_IDS = Object.freeze({ cameraflare: true, fx_adv_rain: true, fx_adv_rain_heavy: true, fx_adv_rain_heavy2: true })
// effect_single prefabs (StoryEffectController.CreateSingleEffect), instantiated under the same BackEffect.
const ADV_SINGLE_PARTICLE_EFFECT_IDS = Object.freeze({ fx_adv_punch: true })

/** Owns persistent background particles, alpha transitions and their resources. */
export class BackgroundEffectManager {
  // nearEffectContainer sits above the idols: native systems with a sorting order above CharacterParent (10).
  constructor({ app, bgEffectContainer, nearEffectContainer = null, getWidth, getHeight, loadTextureFromUrl }) {
    Object.assign(this, { app, bgEffectContainer, nearEffectContainer, getWidth, getHeight, loadTextureFromUrl })
    this._bgEffectEntries = {}
    this._singleEffectEntries = new Set()
    this._effectTextureCache = {}
  }

  /** effect_single: one non-looping prefab at a canvas offset and scale, alpha 1, removed once its last
   *  particle dies. Returns a cancel function, or null when the effect has no native prefab. */
  playSingleParticleEffect(id, { x = 0, y = 0, scale = 1 } = {}, nowMilliseconds = () => performance.now()) {
    if (!(id in ADV_SINGLE_PARTICLE_EFFECT_IDS) || this._shouldDisableBgEffect()) return null
    const entry = { id, prefab: advParticlePrefab(id), container: new PIXI.Container(), frontContainer: new PIXI.Container(),
      sprites: [], loadToken: 0, nowMilliseconds, placement: { x: Number(x) || 0, y: Number(y) || 0, scale: Number(scale) || 1 } }
    entry.activatedAt = nowMilliseconds()
    entry.endsAt = entry.activatedAt + advParticleLifetime(entry.prefab)
    for (const container of [entry.container, entry.frontContainer]) container.eventMode = 'none'
    this.bgEffectContainer.addChild(entry.container)
    ;(this.nearEffectContainer || this.bgEffectContainer).addChild(entry.frontContainer)
    this._singleEffectEntries.add(entry)
    this._createNativeParticleEffect(entry)
    return () => this._disposeEffectEntry(entry)
  }

  applyBgEffects(effects = [], bgProfile = null, nowMilliseconds = () => performance.now()) {
    const normalizedEffects = (effects || []).filter(effect => effect?.id && !this._shouldDisableBgEffect())
    const desired = new Set()
    for (const effect of normalizedEffects) {
      const id = effect?.id
      desired.add(id)
      let entry = this._bgEffectEntries[id]
      // cameraflare instantiates the left or right prefab from the current background's lightPosition.
      if (entry && entry.prefab !== undefined && entry.prefab !== advParticlePrefab(id, bgProfile)) {
        this._removeBgEffect(id)
        entry = null
      }
      if (!entry) {
        entry = this._createBgEffect(id, bgProfile, nowMilliseconds, effect.action === 'start' ? effect.delay : 0)
        this._bgEffectEntries[id] = entry
        if (entry.container) this.bgEffectContainer.addChild(entry.container)
        if (entry.frontContainer) (this.nearEffectContainer || this.bgEffectContainer).addChild(entry.frontContainer)
      }
      entry.bgProfile = bgProfile || entry.bgProfile || null
      const ending = effect.action === 'end' || effect.visible === false
      // Client effect_bgstart [2] is the particle alpha; older compiled data carried it
      // as the start's `duration`. The start itself has no fade-in.
      const starting = effect.action === 'start'
      const legacyAlpha = starting && Number(effect.duration) > 0 ? Number(effect.duration) : undefined
      if (effect.alpha != null || legacyAlpha != null || starting) entry.effectAlpha = effect.alpha ?? legacyAlpha
      const fadeDuration = starting ? 0 : effect.duration
      // Native particles carry the command alpha themselves (squared, see advParticleQuad).
      const targetAlpha = ending ? 0 : this._bgEffectTargetAlpha(id) * (entry.prefab !== undefined ? 1 : (entry.effectAlpha ?? 1))
      if (ending) {
        const delayMs = Math.max(0, Number(effect.delay || 0)) * 1000
        const durationMs = Math.max(0, Number(effect.duration || 0)) * 1000
        entry.pendingEndUntil = entry.nowMilliseconds() + delayMs + durationMs + 80
      } else {
        entry.pendingEndUntil = null
      }
      entry.container.visible = true
      if (entry.frontContainer) entry.frontContainer.visible = true
      this._animateBgEffectAlpha(entry, targetAlpha, fadeDuration, effect.delay, () => {
        if (ending) this._removeBgEffect(id)
      })
    }

    for (const id of Object.keys(this._bgEffectEntries)) {
      if (!desired.has(id)) {
        const entry = this._bgEffectEntries[id]
        if (entry?.pendingEndUntil && entry.nowMilliseconds() < entry.pendingEndUntil) continue
        this._removeBgEffect(id)
      }
    }
  }

  _shouldDisableBgEffect() {
    const params = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams()
    return params.get('bgfx') === '0'
  }

  _createBgEffect(id, bgProfile = null, nowMilliseconds = () => performance.now(), delay = 0) {
    const container = new PIXI.Container()
    container.eventMode = 'none'
    container.alpha = 0
    const entry = { id, container, ticker: null, graphics: [], sprites: [], token: 0, loadToken: 0, bgProfile, nowMilliseconds }

    if (id in ADV_PARTICLE_EFFECT_IDS) {
      entry.prefab = advParticlePrefab(id, bgProfile)
      entry.frontContainer = new PIXI.Container()
      entry.frontContainer.eventMode = 'none'
      entry.frontContainer.alpha = 0
      // effect_bgstart runs CreateBgEffectCoroutine after its delay, without prewarm.
      entry.activatedAt = nowMilliseconds() + Math.max(0, Number(delay) || 0) * 1000
      if (entry.prefab) this._createNativeParticleEffect(entry)
    } else if (id === 'fx_adv_sakura' || id === 'fx_adv_momiji') {
      this._createFallingSpriteEffect(entry, id)
    }

    return entry
  }

  _loadEffectTexture(name) {
    return loadEffectTexture(this._effectTextureCache, name, (url, options) => this.loadTextureFromUrl(url, options))
  }

  async _createNativeParticleEffect(entry) {
    const token = ++entry.loadToken
    const systems = advParticleSystems(entry.prefab)
    try {
      const textures = await Promise.all(systems.map(system => this._loadEffectTexture(system.texture)))
      if (entry.loadToken !== token || !entry.container || entry.container.destroyed) return
      entry.emitters = systems.map((system, index) => {
        const texture = textures[index], columns = system.uv?.columns || 1, rows = system.uv?.rows || 1
        const width = texture.width / columns, height = texture.height / rows
        const frames = system.uv ? Array.from({ length: columns * rows }, (_, i) => new PIXI.Texture(texture.baseTexture,
          new PIXI.Rectangle(texture.frame.x + i % columns * width, texture.frame.y + Math.floor(i / columns) * height, width, height))) : [texture]
        const layer = system.layer === 'front' ? entry.frontContainer : entry.container
        const sprites = Array.from({ length: system.capacity }, () => {
          const sprite = new PIXI.Sprite(frames[0])
          sprite.anchor.set(0.5)
          sprite.visible = false
          sprite.eventMode = 'none'
          // Mobile/Particles/Alpha Blended and Additive over textures premultiplied on upload (effectTextureCache).
          sprite.blendMode = system.blend === 'normal' ? PIXI.BLEND_MODES.NORMAL : PIXI.BLEND_MODES.ADD
          layer.addChild(sprite)
          entry.sprites.push(sprite)
          return sprite
        })
        if (system.uv) entry.frameTextures = [...(entry.frameTextures || []), ...frames]
        return { system, frames, sprites, width, height }
      })
      entry.ticker = () => this._tickNativeParticleEffect(entry)
      this.app.ticker.add(entry.ticker)
      this._tickNativeParticleEffect(entry)
    } catch (err) {
      if (entry.loadToken !== token || !entry.container || entry.container.destroyed) return
      console.warn(`[PixiStageManager] Failed to load bg effect "${entry.id}":`, err?.message || err)
    }
  }

  _tickNativeParticleEffect(entry) {
    if (!entry.emitters || !entry.container || entry.container.destroyed) return
    const time = entry.nowMilliseconds(), width = this.getWidth(), height = this.getHeight()
    if (time >= entry.endsAt) return this._disposeEffectEntry(entry)
    const alpha = advParticleEffectAlpha(entry.id, entry.effectAlpha, entry.bgProfile)
    for (const { system, frames, sprites, width: frameWidth, height: frameHeight } of entry.emitters) {
      const quads = sampleAdvParticles(system, time, entry.activatedAt, alpha, width, height, entry.placement)
      for (let i = 0; i < sprites.length; i++) {
        const sprite = sprites[i], quad = quads[i]
        sprite.visible = Boolean(quad && quad.alpha > 0)
        if (!sprite.visible) continue
        sprite.texture = frames[quad.frame] || frames[0]
        sprite.transform.setFromMatrix(new PIXI.Matrix(quad.a / frameWidth, quad.b / frameWidth,
          quad.c / frameHeight, quad.d / frameHeight, quad.x, quad.y))
        sprite.alpha = quad.alpha
        sprite.tint = quad.tint
      }
    }
  }

  async _createFallingSpriteEffect(entry, id) {
    const token = ++entry.loadToken
    const name = id === 'fx_adv_sakura' ? 'fx_adv_sakura' : 'fx_adv_momiji'
    try {
      const texture = await this._loadEffectTexture(name)
      if (entry.loadToken !== token || !entry.container || entry.container.destroyed) return
      const count = id === 'fx_adv_sakura' ? 32 : 28
      for (let i = 0; i < count; i++) {
        const sprite = new PIXI.Sprite(texture)
        sprite.anchor.set(0.5)
        sprite.blendMode = PIXI.BLEND_MODES.NORMAL
        sprite.alpha = 0.42 + ((i * 17) % 30) / 100
        sprite.scale.set(0.035 + ((i * 11) % 22) / 1000)
        sprite._fxSeed = i * 97
        sprite._fxSpeed = 0.45 + ((i * 13) % 32) / 24
        entry.container.addChild(sprite)
        entry.sprites.push(sprite)
      }
      const startedAt = entry.nowMilliseconds()
      entry.ticker = () => {
        const elapsed = Math.max(0, entry.nowMilliseconds() - startedAt) / 1000
        const width = this.getWidth()
        const height = this.getHeight()
        for (const sprite of entry.sprites) {
          const seed = sprite._fxSeed || 0
          const t = elapsed * sprite._fxSpeed + seed
          sprite.x = ((seed * 23 + t * 42) % (width + 180)) - 90 + Math.sin(t * 1.7) * 38
          sprite.y = ((seed * 11 + t * 58) % (height + 160)) - 100
          sprite.rotation = t * 1.2
        }
      }
      this.app.ticker.add(entry.ticker)
      this._resizeBgEffect(entry)
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to load bg effect "${id}":`, err?.message || err)
    }
  }

  _resizeBgEffects() {
    for (const entry of Object.values(this._bgEffectEntries)) {
      this._resizeBgEffect(entry)
    }
  }

  _resizeBgEffect(entry) {
    if (entry?.emitters) this._tickNativeParticleEffect(entry)
  }

  _bgEffectTargetAlpha(id) {
    if (id in ADV_PARTICLE_EFFECT_IDS) return 1
    if (id === 'fx_adv_sakura' || id === 'fx_adv_momiji') return 0.9
    return 0
  }

  _animateBgEffectAlpha(entry, targetAlpha, duration = 0, delay = 0, onDone = null) {
    if (!entry?.container) return
    entry.alphaTween?.cancel?.()
    const token = (entry.token || 0) + 1
    entry.token = token
    const startAlpha = entry.container.alpha
    const delayMs = Math.max(0, Number(delay || 0)) * 1000
    const durationMs = Math.max(0, Number(duration || 0)) * 1000
    entry.alphaTween = runRafTween({
      durationMs, delayMs, startValue: startAlpha, endValue: targetAlpha,
      nowMilliseconds: entry.nowMilliseconds,
      ease: t => t,
      shouldStop: () => entry.token !== token || !entry.container || entry.container.destroyed,
      onUpdate: alpha => {
        entry.container.alpha = alpha
        if (entry.frontContainer) entry.frontContainer.alpha = alpha
      },
      onComplete: () => {
        entry.alphaTween = null
        entry.container.visible = targetAlpha > 0
        if (entry.frontContainer) entry.frontContainer.visible = targetAlpha > 0
        if (onDone) onDone()
      },
    })
  }

  _removeBgEffect(id) {
    const entry = this._bgEffectEntries[id]
    if (!entry) return
    this._disposeEffectEntry(entry)
    delete this._bgEffectEntries[id]
  }

  _disposeEffectEntry(entry) {
    this._singleEffectEntries.delete(entry)
    entry.alphaTween?.cancel?.()
    entry.alphaTween = null
    entry.token = (entry.token || 0) + 1
    entry.loadToken = (entry.loadToken || 0) + 1
    entry.pendingEndUntil = null
    if (entry.ticker) this.app.ticker.remove(entry.ticker)
    for (const container of [entry.container, entry.frontContainer]) {
      if (!container || container.destroyed) continue
      if (container.parent) container.parent.removeChild(container)
      container.destroy({ children: true })
    }
    for (const texture of entry.frameTextures || []) texture.destroy(false)
    entry.frameTextures = null
    entry.emitters = null
  }

  destroy() {
    for (const entry of [...this._singleEffectEntries]) this._disposeEffectEntry(entry)
    for (const id of Object.keys(this._bgEffectEntries)) this._removeBgEffect(id)
    this._bgEffectEntries = {}
  }
}
