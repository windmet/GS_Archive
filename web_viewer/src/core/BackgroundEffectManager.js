import * as PIXI from 'pixi.js'
import { loadEffectTexture } from './effectTextureCache.js'
import { runRafTween } from './rafTween.js'

/** Owns persistent background particles, alpha transitions and their resources. */
export class BackgroundEffectManager {
  constructor({ app, bgEffectContainer, getWidth, getHeight, loadTextureFromUrl }) {
    Object.assign(this, { app, bgEffectContainer, getWidth, getHeight, loadTextureFromUrl })
    this._bgEffectEntries = {}
    this._cameraflareTextures = null
    this._effectTextureCache = {}
  }

  applyBgEffects(effects = [], bgProfile = null, nowMilliseconds = () => performance.now()) {
    const normalizedEffects = (effects || []).filter(effect => {
      const id = effect?.id
      return id && !this._shouldDisableBgEffect(id)
    })
    const desired = new Set()
    for (const effect of normalizedEffects) {
      const id = effect?.id
      desired.add(id)
      let entry = this._bgEffectEntries[id]
      if (entry && id === 'cameraflare') {
        const nextSide = this._resolveCameraflareSide(bgProfile)
        if (entry.cameraflareSide && entry.cameraflareSide !== nextSide) {
          this._removeBgEffect(id)
          entry = null
        }
      }
      if (!entry) {
        entry = this._createBgEffect(id, bgProfile, nowMilliseconds)
        this._bgEffectEntries[id] = entry
        if (entry.container) this.bgEffectContainer.addChild(entry.container)
      }
      entry.bgProfile = bgProfile || entry.bgProfile || null
      const ending = effect.action === 'end' || effect.visible === false
      const targetAlpha = ending ? 0 : this._bgEffectTargetAlpha(id)
      if (ending) {
        const delayMs = Math.max(0, Number(effect.delay || 0)) * 1000
        const durationMs = Math.max(0, Number(effect.duration || 0)) * 1000
        entry.pendingEndUntil = entry.nowMilliseconds() + delayMs + durationMs + 80
      } else {
        entry.pendingEndUntil = null
      }
      entry.container.visible = true
      this._animateBgEffectAlpha(entry, targetAlpha, effect.duration, effect.delay, () => {
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

  _shouldDisableBgEffect(id) {
    const params = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams()
    if (params.get('bgfx') === '0') return true
    // Archived: the extracted particle attempt was visually poor on web.
    // Keep the implementation below for reference, but do not enable it at runtime.
    if (id === 'cameraflare') return true
    return false
  }

  _createBgEffect(id, bgProfile = null, nowMilliseconds = () => performance.now()) {
    const container = new PIXI.Container()
    container.eventMode = 'none'
    container.alpha = 0
    const entry = { id, container, ticker: null, graphics: [], sprites: [], token: 0, loadToken: 0, bgProfile, nowMilliseconds }

    if (id === 'cameraflare') {
      this._createCameraflareEffect(entry)
    } else if (id.startsWith('fx_adv_rain')) {
      this._createRainEffect(entry)
    } else if (id === 'fx_adv_sakura' || id === 'fx_adv_momiji') {
      this._createFallingSpriteEffect(entry, id)
    }

    return entry
  }

  _loadEffectTexture(name) {
    return loadEffectTexture(this._effectTextureCache, name, url => this.loadTextureFromUrl(url))
  }

  async _createCameraflareEffect(entry) {
    const token = ++entry.loadToken
    try {
      const texture = await this._loadEffectTexture('fx_adv_flare_01')
      if (entry.loadToken !== token || !entry.container || entry.container.destroyed) return

      const cells = [
        this._makeFlareSubTexture(texture, 0, 0),
        this._makeFlareSubTexture(texture, 1, 0),
        this._makeFlareSubTexture(texture, 0, 1),
        this._makeFlareSubTexture(texture, 1, 1),
      ]
      entry.cameraflareSide = this._resolveCameraflareSide(entry.bgProfile)
      const sides = entry.cameraflareSide === 'both' ? ['left', 'right'] : [entry.cameraflareSide]
      entry.emitters = sides
        .map(side => this._createCameraflareEmitter(entry, cells, side))
        .filter(Boolean)
      entry.emitters.forEach(emitter => {
        emitter.particles.forEach(sprite => entry.container.addChild(sprite))
      })

      const startedAt = entry.nowMilliseconds()
      entry.ticker = () => {
        const elapsed = Math.max(0, entry.nowMilliseconds() - startedAt) / 1000
        this._tickCameraflareEmitters(entry, elapsed)
      }
      this.app.ticker.add(entry.ticker)
      this._resizeBgEffect(entry)
    } catch (err) {
      console.warn('[PixiStageManager] Failed to load cameraflare texture:', err?.message || err)
    }
  }

  _createCameraflareEmitter(entry, textures, side) {
    const particles = []
    for (let i = 0; i < 10; i++) {
      const sprite = this._makeFlareSprite(textures[0], { tint: 0xffffff })
      sprite.visible = false
      sprite._fxSeed = (side === 'left' ? 1000 : 2000) + i * 137
      particles.push(sprite)
      entry.sprites.push(sprite)
    }
    return {
      side,
      textures,
      particles,
      // Unity: maxParticles=10, startLifetime=4, rateOverTime scalar=1.
      emitInterval: 1,
      lifetime: 4,
      maxParticles: 10,
      parent: { x: 512, y: 253, scale: 72 },
      local: side === 'left'
        ? { x: -15.600000381469727, y: -0.10000000149011612 }
        : { x: 1.399999976158142, y: 0.8999999761581421 },
    }
  }

  _tickCameraflareEmitters(entry, elapsed) {
    const width = this.getWidth()
    const height = this.getHeight()
    const stageScale = Math.max(width / 1024, height / 506)
    const params = this._getCameraflareParams()
    const lightAlpha = Number(entry.bgProfile?.lightAlpha ?? 1)
    const strength = params.strength * (Number.isFinite(lightAlpha) ? lightAlpha : 1) * 0.470588237

    for (const emitter of entry.emitters || []) {
      const baseX = this._projectCameraflareX(emitter, stageScale)
      const baseY = this._projectCameraflareY(emitter, stageScale)
      for (let i = 0; i < emitter.particles.length; i++) {
        const sprite = emitter.particles[i]
        const seed = sprite._fxSeed || 0
        const age = (elapsed + i * emitter.emitInterval) % emitter.lifetime
        const t = age / emitter.lifetime
        const activeCount = Math.min(emitter.maxParticles, Math.ceil(emitter.lifetime / emitter.emitInterval))
        sprite.visible = i < activeCount
        if (!sprite.visible) continue

        const randA = this._hashUnit(seed)
        const randB = this._hashUnit(seed + 1)
        const randC = this._hashUnit(seed + 2)
        const angle = randA * Math.PI * 2
        const radius = Math.sqrt(randB) * 40 * stageScale
        sprite.x = baseX + Math.cos(angle) * radius
        sprite.y = baseY + Math.sin(angle) * radius

        const frame = params.frame === 'random' ? Math.floor(randC * 4) : 0
        sprite.texture = emitter.textures[Math.max(0, Math.min(3, frame))]

        sprite.scale.set(params.size * stageScale / 2)
        const startRotation = (-20 + this._hashUnit(seed + 4) * 40) * Math.PI / 180
        sprite.rotation = startRotation + age * 0.0872664600610733
        sprite.alpha = strength * this._cameraflareAlphaAt(t)
      }
    }
    if (params.debug && !entry._cameraflareDebugLogged) {
      entry._cameraflareDebugLogged = true
      console.info('[cameraflare]', {
        side: entry.cameraflareSide,
        lightPosition: entry.bgProfile?.lightPosition,
        lightAlpha: entry.bgProfile?.lightAlpha,
        strength: params.strength,
        size: params.size,
        frame: params.frame,
      })
    }
  }

  _resolveCameraflareSide(bgProfile = null) {
    const { side } = this._getCameraflareParams()
    if (side === 'left' || side === 'right' || side === 'both') return side
    const position = Number(bgProfile?.lightPosition ?? 0)
    return position === 1 ? 'left' : 'right'
  }

  _projectCameraflareX(emitter) {
    return emitter.side === 'left' ? this.getWidth() * 0.08 : this.getWidth() * 0.92
  }

  _projectCameraflareY() {
    return this.getHeight() * 0.1
  }

  _getCameraflareParams() {
    const params = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams()
    const side = params.get('flareSide') || 'auto'
    const strength = Number(params.get('flareStrength') ?? 0.025)
    const size = Number(params.get('flareSize') ?? 2.4)
    const frame = params.get('flareFrame') || 'static'
    return {
      side: ['auto', 'left', 'right', 'both'].includes(side) ? side : 'auto',
      strength: Number.isFinite(strength) ? strength : 0.025,
      size: Number.isFinite(size) ? size : 2.4,
      frame: frame === 'random' ? 'random' : 'static',
      debug: params.get('flareDebug') === '1',
    }
  }

  _hashUnit(seed) {
    const x = Math.sin(seed * 12.9898) * 43758.5453
    return x - Math.floor(x)
  }

  _cameraflareAlphaAt(t) {
    if (t <= 0.1) return t / 0.1
    if (t <= 0.8) return 1
    return Math.max(0, 1 - (t - 0.8) / 0.2)
  }

  _makeFlareSubTexture(texture, cellX, cellY) {
    const size = Math.floor(Math.min(texture.width, texture.height) / 2)
    return new PIXI.Texture(
      texture.baseTexture,
      new PIXI.Rectangle(cellX * size, cellY * size, size, size),
    )
  }

  _makeFlareSprite(texture, options = {}) {
    const sprite = new PIXI.Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.blendMode = PIXI.BLEND_MODES.ADD
    sprite.tint = options.tint ?? 0xffffff
    sprite.alpha = options.alpha ?? 1
    sprite.eventMode = 'none'
    return sprite
  }

  async _createRainEffect(entry) {
    const token = ++entry.loadToken
    try {
      const texture = await this._loadEffectTexture('fx_adv_rain')
      if (entry.loadToken !== token || !entry.container || entry.container.destroyed) return

      const heavy = entry.id.includes('heavy')
      const layers = heavy ? 3 : 2
      for (let i = 0; i < layers; i++) {
        const tile = new PIXI.TilingSprite(texture, this.getWidth() + 320, this.getHeight() + 320)
        tile.anchor?.set?.(0)
        tile.alpha = heavy ? 0.34 - i * 0.06 : 0.24 - i * 0.04
        tile.blendMode = PIXI.BLEND_MODES.ADD
        tile.rotation = -0.28
        tile.x = -160 - i * 40
        tile.y = -140
        tile.tileScale.set(heavy ? 0.92 + i * 0.18 : 0.72 + i * 0.14)
        entry.container.addChild(tile)
        entry.sprites.push(tile)
      }
      const speed = heavy ? 15 : 9
      const startedAt = entry.nowMilliseconds()
      entry.ticker = () => {
        const delta = Math.max(0, entry.nowMilliseconds() - startedAt) / 1000 * 60
        for (let i = 0; i < entry.sprites.length; i++) {
          const tile = entry.sprites[i]
          tile.tilePosition.x = - (speed * 0.45 + i * 1.4) * delta
          tile.tilePosition.y = (speed + i * 2.5) * delta
        }
      }
      this.app.ticker.add(entry.ticker)
      this._resizeBgEffect(entry)
    } catch (err) {
      if (entry.loadToken !== token || !entry.container || entry.container.destroyed) return
      const rain = new PIXI.Graphics()
      this._drawRain(rain, entry.id)
      entry.container.addChild(rain)
      entry.graphics.push(rain)
      const speed = entry.id.includes('heavy') ? 9 : 5
      const startedAt = entry.nowMilliseconds()
      entry.ticker = () => {
        const frames = Math.max(0, entry.nowMilliseconds() - startedAt) / 1000 * 60
        rain.y = (frames * speed) % ((Math.floor(28 / speed) + 1) * speed)
      }
      this.app.ticker.add(entry.ticker)
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
      this._resizeBgEffect(entry)
    }
  }

  _resizeBgEffect(entry) {
    if (!entry) return
    if (entry.id === 'cameraflare' && entry.emitters?.length) {
      this._tickCameraflareEmitters(entry, performance.now() / 1000)
    } else if (entry.id?.startsWith('fx_adv_rain') && entry.sprites?.length) {
      for (const tile of entry.sprites) {
        tile.width = this.getWidth() + 320
        tile.height = this.getHeight() + 320
      }
    } else if (entry.id?.startsWith('fx_adv_rain') && entry.graphics?.length) {
      this._drawRain(entry.graphics[0], entry.id)
    }
  }

  _bgEffectTargetAlpha(id) {
    if (id === 'cameraflare') return 1
    if (id.startsWith('fx_adv_rain')) return 0.85
    if (id === 'fx_adv_sakura' || id === 'fx_adv_momiji') return 0.9
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
      onUpdate: alpha => { entry.container.alpha = alpha },
      onComplete: () => {
        entry.alphaTween = null
        entry.container.visible = targetAlpha > 0
        if (onDone) onDone()
      },
    })
  }

  _removeBgEffect(id) {
    const entry = this._bgEffectEntries[id]
    if (!entry) return
    entry.alphaTween?.cancel?.()
    entry.alphaTween = null
    entry.token = (entry.token || 0) + 1
    entry.loadToken = (entry.loadToken || 0) + 1
    entry.pendingEndUntil = null
    if (entry.ticker) this.app.ticker.remove(entry.ticker)
    if (entry.container?.parent) entry.container.parent.removeChild(entry.container)
    entry.container?.destroy({ children: true })
    delete this._bgEffectEntries[id]
  }

  destroy() {
    for (const id of Object.keys(this._bgEffectEntries)) this._removeBgEffect(id)
    this._bgEffectEntries = {}
  }
}
