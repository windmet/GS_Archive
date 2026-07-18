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
    this._bgTransition = null
    this._blurFilter = null
    this._bgBlurAmount = 0
    this._bgBlurTween = null
    this._bgColorTween = null
    this._bgOverlaySprite = null
    this._bgOverlayColor = 0xFFFFFF
    this._bgEffectEntries = {}
    this._cameraflareTextures = null
    this._effectTextureCache = {}
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
    const oldBgId = this.currentBgId
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
      const durationSeconds = transition?.duration == null ? 0.5 : Number(transition.duration)
      const durationMs = Math.max(0, Number.isFinite(durationSeconds) ? durationSeconds : 0.5) * 1000
      let resolveTransition
      const finished = new Promise(resolve => { resolveTransition = resolve })
      const start = performance.now()
      const record = {
        token,
        oldBgId,
        newBgId: bgId,
        oldSprite,
        newSprite,
        tickerFn: null,
        resolve: resolveTransition,
      }
      const tickerFn = () => {
        if (token !== this._bgTransitionToken) {
          this.app.ticker.remove(tickerFn)
          return
        }
        const elapsed = performance.now() - start
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
      if (this.currentBgId === bgId) this.currentBgId = oldBgId
      console.warn(`[PixiStageManager] Failed to load bg "${bgId}":`, err?.message || err)
    }
  }

  settleBackgroundTransition() {
    const record = this._bgTransition
    if (!record) return false
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

  applyBgEffects(effects = [], bgProfile = null) {
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
        entry = this._createBgEffect(id, bgProfile)
        this._bgEffectEntries[id] = entry
        if (entry.container) this.bgEffectContainer.addChild(entry.container)
      }
      entry.bgProfile = bgProfile || entry.bgProfile || null
      const ending = effect.action === 'end' || effect.visible === false
      const targetAlpha = ending ? 0 : this._bgEffectTargetAlpha(id)
      if (ending) {
        const delayMs = Math.max(0, Number(effect.delay || 0)) * 1000
        const durationMs = Math.max(0, Number(effect.duration || 0)) * 1000
        entry.pendingEndUntil = performance.now() + delayMs + durationMs + 80
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
        if (entry?.pendingEndUntil && performance.now() < entry.pendingEndUntil) continue
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

  _createBgEffect(id, bgProfile = null) {
    const container = new PIXI.Container()
    container.eventMode = 'none'
    container.alpha = 0
    const entry = { id, container, ticker: null, graphics: [], sprites: [], token: 0, loadToken: 0, bgProfile }

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
    if (!this._effectTextureCache[name]) {
      this._effectTextureCache[name] = this.loadTextureFromUrl(`/data/fx_extracted/unity_${name}.png`)
    }
    return this._effectTextureCache[name]
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

      let elapsed = 0
      entry.ticker = (delta) => {
        elapsed += delta / 60
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
      entry.ticker = (delta) => {
        for (let i = 0; i < entry.sprites.length; i++) {
          const tile = entry.sprites[i]
          tile.tilePosition.x -= (speed * 0.45 + i * 1.4) * delta
          tile.tilePosition.y += (speed + i * 2.5) * delta
        }
      }
      this.app.ticker.add(entry.ticker)
      this._resizeBgEffect(entry)
    } catch (err) {
      const rain = new PIXI.Graphics()
      this._drawRain(rain, entry.id)
      entry.container.addChild(rain)
      entry.graphics.push(rain)
      const speed = entry.id.includes('heavy') ? 9 : 5
      entry.ticker = () => {
        rain.y += speed
        if (rain.y > 28) rain.y = 0
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
      let elapsed = 0
      entry.ticker = (delta) => {
        elapsed += delta / 60
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
    entry.loadToken = (entry.loadToken || 0) + 1
    entry.pendingEndUntil = null
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
