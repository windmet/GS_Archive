import { SPINE_TRACK } from './spineTracks.js'
import { withLoadDeadline } from './AsyncLoadBoundary.js'
import { stageRenderResolution } from './StageRenderBudget.js'
import { decodeSpineAtlasText } from '../../shared/story/SpineAtlasPages.js'
import { decodeUnitySpineSkeleton } from '../../shared/story/SpineBinary.js'
/**
 * PixiStageManager manages the PixiJS canvas/renderer and stage graph.
 *
 * Spine loading strategy (SideM-specific):
 * - Do not use PIXI.Assets or @pixi-spine/loader-3.8 for Spine loading.
 * - Load atlas, skeleton, and texture data manually to match the game's
 *   Unity-exported Spine 3.8 assets.
 *
 * Debug features:
 * - Drag any spine to reposition visually for calibration.
 * - A red origin marker helps locate each spine's (0,0) point.
 * - Scale can be adjusted via changeSpineScale().
 */


import * as PIXI from 'pixi.js'
import { Spine, SkeletonBinary, AtlasAttachmentLoader } from '@pixi-spine/runtime-3.8'
import { TextureAtlas } from '@pixi-spine/base'
import { getBgUrl, getMouthSettingUrl, getSpineAtlasUrl, getSpineSkelUrl, getSilhouetteUrl } from '../utils/AssetResolver.js'
import { resolveSpineTextureUrl } from '../utils/SpineTextureUrl.js'
import { idolSlotPosition, skeletonFigureScreen, textureFigureScreen, TEXTURE_FIGURE_POSITION_Y } from '../../shared/story/AdvStageLayout.js'
import { easeOutCubic, runRafTween } from './rafTween.js'
import { tweenOverlayFade, tweenOverlaySlide } from './transitionTweens.js'
import { loadAndCreateSpine } from './spineSpawnPipeline.js'
import { finalizeSpawnedSpine } from './spineSpawnFinalize.js'
import { BackgroundManager } from './BackgroundManager.js'
import { ScreenEffectManager } from './ScreenEffectManager.js'
import { loadImageTexture } from './loadImageTexture.js'
import { CameraController } from './CameraController.js'
import { ColorFilterController } from './ColorFilterController.js'
import { IDENTITY_COLOR_FILTER, backgroundIdolColorPreset, cameraColorPreset } from '../../shared/story/ColorFilter.js'
import { SpineManager } from './SpineManager.js'

import { LipSyncController } from './LipSyncController.js'
import { installNativeFramePose } from './spineFramePose.js'
import { faceEffectSlots, hideFaceEffects } from './spineFaceEffects.js'

// IdolFigureSkeleton._trackIndexCloseEye / ANIMATION_EYE_CLOSE (client 2.6.10).
const EYE_TRACK = SPINE_TRACK.eye
const EYE_CLOSE_ANIMATION = 'eye_close'
export class PixiStageManager {
  setPresentationSuspended(suspended) {
    this.presentationSuspended = suspended
    this._visibilityHandler?.()
  }

  constructor(containerEl, options = {}) {
    this.container = containerEl
    this.width = options.width || containerEl.clientWidth || 1280
    this.height = options.height || containerEl.clientHeight || 720
    this.presentationScale = options.presentationScale || 1

    this.app = null
    this._destroyed = false
    this.spineInstances = {}   // { idolId: { spine: Spine, modelId: string, marker: Graphics } }
    this._spawnTokens = {}
    this._spawnLoads = new Map()
    this._textureOwner = new AbortController()
    this._silhouetteSprites = {}  // { idolId: { modelId, sprite, texture, adv } } — texture figures
    this._silhouettePending = {}  // { idolId: { token, modelId, texture, adv } }
    this._silhouetteLoadTokens = {}
    this._pendingTalking = {}
    this.lipSyncController = new LipSyncController({
      getSpineEntry: idolId => this.spineInstances[idolId],
      getMouthSettingUrl,
    })
    this._pendingTalking = this.lipSyncController.pendingTalking
    this._debugMode = false

  // Screen fade overlay
    this._fadeOverlay = null     // PIXI.Sprite for screen transitions
    this._screenFadeToken = 0
    this._slideOverlay = null
    this._screenSlideToken = 0
    this._effectOverlay = null
    this.screenEffects = null

    // Visual filters
    this._blurFilter = null     // PIXI.BlurFilter for bg DOF
    this._bgOverlaySprite = null  // color overlay sprite for bg_color
    this._bgBlurAmount = 0
    this._bgOverlayColor = 0xFFFFFF
    this._spineColorTweens = {}

    this._init()
    this._observeResize()
  }

  _init() {
    this.app = new PIXI.Application({
      width: this.width,
      height: this.height,
      backgroundColor: 0x000000,
      antialias: true,
      resolution: stageRenderResolution(this.width, this.height, this.presentationScale, globalThis.devicePixelRatio),
      autoDensity: true,
    })
    this.app.ticker.maxFPS = 60
    this._visibilityHandler = () => {
      if (document.hidden || this.presentationSuspended) this.app?.stop()
      else this.app?.start()
    }
    document.addEventListener('visibilitychange', this._visibilityHandler)
    this._visibilityHandler()
    this.container.appendChild(this.app.view)

    // Layer structure: bgContainer (bottom) -> bgEffectContainer -> spineContainer -> nearEffectContainer
    // -> fadeOverlay (top). The effect layers are StoryIdolCanvas BackEffect particles below and above
    // CharacterParent's sorting order, and move with the camera like the idols.
    this.bgContainer = new PIXI.Container()
    this.bgEffectContainer = new PIXI.Container()
    this.spineContainer = new PIXI.Container()
    this.nearEffectContainer = new PIXI.Container()
    this.app.stage.addChild(this.bgContainer)
    this.app.stage.addChild(this.bgEffectContainer)
    this.app.stage.addChild(this.spineContainer)
    this.app.stage.addChild(this.nearEffectContainer)
    this.backgroundManager = new BackgroundManager({
      app: this.app,
      bgContainer: this.bgContainer,
      bgEffectContainer: this.bgEffectContainer,
      nearEffectContainer: this.nearEffectContainer,
      getWidth: () => this.width,
      getHeight: () => this.height,
      getBgUrl,
      loadTextureFromUrl: (url, options) => this._loadTextureFromUrl(url, options),
    })
    this.cameraController = new CameraController({
      bgContainer: this.bgContainer,
      spineContainer: this.spineContainer,
      effectContainers: [this.bgEffectContainer, this.nearEffectContainer],
      getWidth: () => this.width,
      getHeight: () => this.height,
      onCameraMove: zoom => this.backgroundManager?.setCameraBlur(zoom),
    })
    this.cameraColorFilter = new ColorFilterController({ app: this.app, getTarget: () => this.app?.stage })
    this.idolColorFilter = new ColorFilterController({ app: this.app, getTarget: () => this.spineContainer })
    this.spineManager = new SpineManager(this)
    this._debugOverlay = new PIXI.Container()
    this._debugOverlay.eventMode = 'none'
    this.app.stage.addChild(this._debugOverlay)

    // Setup screen fade overlay (fullscreen, invisible by default)
    this._fadeOverlay = new PIXI.Sprite(PIXI.Texture.WHITE)
    this._fadeOverlay.width = this.width
    this._fadeOverlay.height = this.height
    this._fadeOverlay.alpha = 0
    this._fadeOverlay.visible = false
    this._fadeOverlay.eventMode = 'none'
    this.app.stage.addChild(this._fadeOverlay)
    this._slideOverlay = new PIXI.Sprite(PIXI.Texture.WHITE)
    this._slideOverlay.width = this.width
    this._slideOverlay.height = this.height
    this._slideOverlay.alpha = 1
    this._slideOverlay.visible = false
    this._slideOverlay.eventMode = 'none'
    this.app.stage.addChild(this._slideOverlay)
    this._effectOverlay = new PIXI.Sprite(PIXI.Texture.WHITE)
    this._effectOverlay.width = this.width
    this._effectOverlay.height = this.height
    this._effectOverlay.alpha = 0
    this._effectOverlay.visible = false
    this._effectOverlay.eventMode = 'none'
    this.app.stage.addChild(this._effectOverlay)
    this.screenEffects = new ScreenEffectManager({
      app: this.app, overlay: this._effectOverlay, spineContainer: this.spineContainer,
      getWidth: () => this.width, getHeight: () => this.height,
      loadTextureFromUrl: (url, options) => this._loadTextureFromUrl(url, { ...options, allowFallback: false }),
    })
    this._debugMarkerUpdater = () => {
      if (!this._debugMode) return
      for (const entry of Object.values(this.spineInstances)) {
        const marker = entry?.marker
        if (!marker || marker.destroyed) continue
        marker.visible = this._debugMode
        const global = entry.spine?.toGlobal
          ? entry.spine.toGlobal(new PIXI.Point(0, 0))
          : { x: entry.spine?.x || 0, y: entry.spine?.y || 0 }
        marker.x = global.x
        marker.y = global.y
      }
    }
    this.app.ticker.add(this._debugMarkerUpdater)
  }

  setPresentationScale(scale) {
    if (this.presentationScale === scale) return
    this.presentationScale = scale
    this._syncRenderResolution()
    this.app.renderer.resize(this.width, this.height)
  }

  _syncRenderResolution() {
    const resolution = stageRenderResolution(this.width, this.height, this.presentationScale, globalThis.devicePixelRatio)
    this.app.renderer.resolution = resolution
    for (const entry of Object.values(this.spineInstances)) {
      if (entry.wrapper?._wholeModelAlpha) entry.wrapper._wholeModelAlpha.resolution = resolution
    }
  }

  _observeResize() {
    this._resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          this.width = width
          this.height = height
          this._syncRenderResolution()
          this.app.renderer.resize(width, height)
          this.backgroundManager?.handleResize()
          this.cameraController?.handleResize()
          if (this._fadeOverlay) {
            this._fadeOverlay.width = width
            this._fadeOverlay.height = height
          }
          if (this._slideOverlay) {
            this._slideOverlay.width = width
            this._slideOverlay.height = height
          }
          if (this._effectOverlay) {
            this._effectOverlay.width = width
            this._effectOverlay.height = height
          }
          this._layoutAllActors()
        }
      }
    })
    this._resizeObserver.observe(this.container)
  }
  // Debug mode

  setDebugMode(enabled) {
    this._debugMode = enabled
    for (const entry of Object.values(this.spineInstances)) {
      if (entry.marker) entry.marker.visible = enabled
      if (entry.spine) entry.spine.eventMode = enabled ? 'dynamic' : 'none'
    }
  }

  getSpineStates() {
    const states = {}
    for (const [id, entry] of Object.entries(this.spineInstances)) {
      states[id] = {
        x: Math.round(entry.spine.x),
        y: Math.round(entry.spine.y),
        scale: entry.spine.scale.x,
        modelId: entry.modelId,
      }
    }
    return states
  }

  getSpineRuntimeSnapshot(idolId) {
    const entry = this.spineInstances[idolId]
    if (!entry?.spine) return null
    const spine = entry.spine
    let bounds = null
    try {
      bounds = spine.getBounds()
    } catch (_) {
      bounds = null
    }
    let localBounds = null
    try {
      localBounds = spine.getLocalBounds()
    } catch (_) {
      localBounds = null
    }
    const skeletonLocalBounds = this.getSkeletonLocalBounds(spine)
    const stageScaleX = this.spineContainer?.scale?.x || 1
    const stageScaleY = this.spineContainer?.scale?.y || 1
    const stageX = this.spineContainer?.x || 0
    const stageY = this.spineContainer?.y || 0
    const tracks = Array.isArray(spine.state?.tracks)
      ? spine.state.tracks.map((track, index) => track ? {
        index,
        animation: track.animation?.name || null,
        trackTime: track.trackTime ?? null,
        animationLast: track.animationLast ?? null,
        mixTime: track.mixTime ?? null,
        mixDuration: track.mixDuration ?? null,
        loop: !!track.loop,
        alpha: track.alpha ?? null,
      } : null)
      : null
    return {
      idolId,
      modelId: entry.modelId,
      root: {
        x: spine.x,
        y: spine.y,
        scaleX: spine.scale.x,
        scaleY: spine.scale.y,
      },
      scale: { current: spine.scale.x },
      stage: {
        x: stageX,
        y: stageY,
        scaleX: stageScaleX,
        scaleY: stageScaleY,
      },
      bounds: bounds ? {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        top: bounds.y,
        bottom: bounds.y + bounds.height,
        left: bounds.x,
        right: bounds.x + bounds.width,
        centerY: bounds.y + bounds.height / 2,
        rootToTop: bounds.y - spine.y,
        rootToBottom: bounds.y + bounds.height - spine.y,
      } : null,
      displayLocalBounds: localBounds ? {
        x: localBounds.x,
        y: localBounds.y,
        width: localBounds.width,
        height: localBounds.height,
        top: localBounds.y,
        bottom: localBounds.y + localBounds.height,
        centerY: localBounds.y + localBounds.height / 2,
      } : null,
      localBounds: localBounds ? {
        x: localBounds.x,
        y: localBounds.y,
        width: localBounds.width,
        height: localBounds.height,
        top: localBounds.y,
        bottom: localBounds.y + localBounds.height,
        centerY: localBounds.y + localBounds.height / 2,
      } : null,
      skeletonLocalBounds: skeletonLocalBounds ? {
        x: skeletonLocalBounds.x,
        y: skeletonLocalBounds.y,
        width: skeletonLocalBounds.width,
        height: skeletonLocalBounds.height,
        top: skeletonLocalBounds.top,
        bottom: skeletonLocalBounds.bottom,
        centerY: skeletonLocalBounds.centerY,
      } : null,
      baselineSkeletonLocalBounds: entry.baselineSkeletonLocalBounds ? {
        x: entry.baselineSkeletonLocalBounds.x,
        y: entry.baselineSkeletonLocalBounds.y,
        width: entry.baselineSkeletonLocalBounds.width,
        height: entry.baselineSkeletonLocalBounds.height,
        top: entry.baselineSkeletonLocalBounds.top,
        bottom: entry.baselineSkeletonLocalBounds.bottom,
        centerY: entry.baselineSkeletonLocalBounds.centerY,
      } : null,
      baseline: {
        capturedAt: entry.baselineCapturedAt || null,
        captureReason: entry.baselineCaptureReason || null,
        bodyAnim: entry.baselineBodyAnim || null,
        faceAnim: entry.baselineFaceAnim || null,
        tracks: entry.baselineTracks || null,
      },
      skeleton: {
        width: spine.skeleton?.data?.width || null,
        height: spine.skeleton?.data?.height || null,
      },
      placement: { figure: entry.figure || null, adv: entry.adv || null },
      tracks,
    }
  }

  getSkeletonLocalBounds(spine) {
    const skeleton = spine?.skeleton
    if (!skeleton) return null
    try {
      skeleton.updateWorldTransform?.()
    } catch (_) {}
    const offset = { x: 0, y: 0 }
    const size = { x: 0, y: 0 }
    try {
      const result = typeof skeleton.getBounds === 'function'
        ? skeleton.getBounds(offset, size, [])
        : null
      if (result && Number.isFinite(result.x) && Number.isFinite(result.width) && Number.isFinite(result.height)) {
        return {
          x: result.x,
          y: result.y,
          width: result.width,
          height: result.height,
          top: result.y,
          bottom: result.y + result.height,
          centerY: result.y + result.height / 2,
        }
      }
      if (Number.isFinite(offset.x) && Number.isFinite(offset.y) && Number.isFinite(size.x) && Number.isFinite(size.y)) {
        return {
          x: offset.x,
          y: offset.y,
          width: size.x,
          height: size.y,
          top: offset.y,
          bottom: offset.y + size.y,
          centerY: offset.y + size.y / 2,
        }
      }
    } catch (_) {}
    try {
      const local = typeof spine?.getLocalBounds === 'function' ? spine.getLocalBounds() : null
      if (local && Number.isFinite(local.x) && Number.isFinite(local.width) && Number.isFinite(local.height)) {
        return {
          x: local.x,
          y: local.y,
          width: local.width,
          height: local.height,
          top: local.y,
          bottom: local.y + local.height,
          centerY: local.y + local.height / 2,
        }
      }
    } catch (_) {}
    try {
      const bounds = typeof spine?.getBounds === 'function' ? spine.getBounds() : null
      if (bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.width) && Number.isFinite(bounds.height)) {
        return {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          top: bounds.y,
          bottom: bounds.y + bounds.height,
          centerY: bounds.y + bounds.height / 2,
        }
      }
    } catch (_) {}
    return null
  }

  changeSpineScale(idolId, delta) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const s = entry.spine.scale.x
    const newScale = Math.max(0.001, Math.min(100, s + delta))
    entry.spine.scale.set(newScale)
    this._emitSpineState(idolId)
  }
  get bgSprite() {
    return this.backgroundManager?.bgSprite ?? null
  }

  // Background

  setBackground(bgId, transition = null) {
    return this.backgroundManager?.setBackground(bgId, transition)
  }

  clearBackground() {
    return this.backgroundManager?.clearBackground()
  }

  setBgBlur(amount, duration = 0, delay = 0, nowMilliseconds) {
    return this.backgroundManager?.setBgBlur(amount, duration, delay, nowMilliseconds)
  }

  clearBgBlur() {
    return this.backgroundManager?.clearBgBlur()
  }

  setBgColor(hexColor, duration = 0, delay = 0, nowMilliseconds) {
    return this.backgroundManager?.setBgColor(hexColor, duration, delay, nowMilliseconds)
  }

  clearBgColor() {
    return this.backgroundManager?.clearBgColor()
  }

  _hexToRgb(color) {
    return { r: (color >> 16) & 255, g: (color >> 8) & 255, b: color & 255 }
  }

  _rgbToHex({ r, g, b }) {
    return ((Math.round(r) & 255) << 16) | ((Math.round(g) & 255) << 8) | (Math.round(b) & 255)
  }

  applyBgEffects(effects = [], bgProfile = null, nowMilliseconds) {
    return this.backgroundManager?.applyBgEffects(effects, bgProfile, nowMilliseconds)
  }

  _createBgEffect(id) {
    return this.backgroundManager?._createBgEffect(id)
  }

  _drawRain(graphics, id) {
    return this.backgroundManager?._drawRain(graphics, id)
  }

  _resizeBgEffects() {
    return this.backgroundManager?._resizeBgEffects()
  }

  _bgEffectTargetAlpha(id) {
    return this.backgroundManager?._bgEffectTargetAlpha(id)
  }

  _loadCameraflareTextures() {
    return this.backgroundManager?._loadCameraflareTextures()
  }

  _animateBgEffectAlpha(entry, targetAlpha, duration = 0, delay = 0, onDone = null) {
    return this.backgroundManager?._animateBgEffectAlpha(entry, targetAlpha, duration, delay, onDone)
  }

  _removeBgEffect(id) {
    return this.backgroundManager?._removeBgEffect(id)
  }

  // Visual Filters

  /**
   * camera_color / camera_defaultcolor: the Camera target of Growing.ColorFilter, over the whole stage.
   * @param {string|null} filter - color_preset_<name>, or null for the default (identity) preset.
   * @param {{delay: number, duration: number}|null} transition - the authoring step's one-shot timing.
   */
  setCameraFilter(filter, transition = null, nowMilliseconds) {
    const preset = filter ? cameraColorPreset(filter) : IDENTITY_COLOR_FILTER
    if (!preset) console.warn(`[PixiStageManager] Unknown camera color preset "${filter}"`)
    this.cameraColorFilter.set(preset || IDENTITY_COLOR_FILTER, { ...(transition || {}), nowMilliseconds })
  }

  /** The IdolFigure target: the current background's preset, applied instantly when the sprite is swapped. */
  setIdolBackgroundColorFilter(bgProfile) {
    this.idolColorFilter.set(backgroundIdolColorPreset(bgProfile))
  }

  // Camera zoom / pan

  /**
   * Apply camera zoom and offset to the visual stage.
   * Camera at (offsetX, offsetY) with zoom factor. Background and characters
   * share the transform so authored bg closeups do not become character-only
   * pulls.
   */
  setCameraZoom(zoomData) {
    this.cameraController?.setCameraZoom(zoomData)
  }

  resetCameraZoom() {
    this.cameraController?.resetCameraZoom()
  }

  // Screen fade overlay

  /**
   * Animate the screen fade overlay.
   * @param {string} type - "in" (fade from color to clear) or "out" (fade to color)
   * @param {string} color - hex color e.g. "#000000" or "#FFFFFF"
   * @param {number} duration - animation duration in seconds
   * @returns {Promise} resolves when animation completes
   */
  setScreenFade(type, color, duration, delay = 0, maxAlpha = 1, nowMilliseconds) {
    const token = ++this._screenFadeToken
    this._screenFadeTween = null
    return new Promise(resolve => {
      if (!this._fadeOverlay || this._fadeOverlay.destroyed) {
        resolve()
        return
      }
      const hex = parseInt(color.replace('#', ''), 16)
      this._fadeOverlay.tint = hex
      this._fadeOverlay.visible = true

      const alpha = Math.max(0, Math.min(1, Number(maxAlpha ?? 1)))
      const startAlpha = type === 'in' ? alpha : 0
      const endAlpha = type === 'in' ? 0 : alpha
      this._fadeOverlay.alpha = startAlpha

      const dur = Math.max(duration, 0) * 1000
      const delayMs = Math.max(0, Number(delay || 0)) * 1000
      if (dur <= 0) {
        if (token !== this._screenFadeToken) { resolve(); return }
        this._fadeOverlay.alpha = endAlpha
        if (type === 'in') this._fadeOverlay.visible = false
        resolve()
        return
      }
      // Retain timing for inspection; existing tokens still control cancellation.
      this._screenFadeTween = tweenOverlayFade({
        overlay: this._fadeOverlay,
        token,
        isCurrent: t => t === this._screenFadeToken,
        durationMs: dur,
        delayMs,
        startAlpha,
        endAlpha,
        nowMilliseconds,
        onFinish: () => {
          if (type === 'in' && this._fadeOverlay && !this._fadeOverlay.destroyed) {
            this._fadeOverlay.visible = false
          }
          resolve()
        },
      })
    })
  }

  clearScreenFade() {
    this._screenFadeToken++
    this._screenFadeTween = null
    if (!this._fadeOverlay || this._fadeOverlay.destroyed) return
    this._fadeOverlay.alpha = 0
    this._fadeOverlay.visible = false
  }

  clearScreenEffects() {
    this.screenEffects?.clearScreenEffects()
  }

  playScreenEffects(effects = [], options = {}) {
    return this.screenEffects?.playScreenEffects(effects, options)
  }

  setScreenSlide(type, color = '#000000', duration = 0.5, delay = 0, direction = '6', nowMilliseconds) {
    const token = ++this._screenSlideToken
    if (!this._slideOverlay || this._slideOverlay.destroyed) return
    const overlay = this._slideOverlay
    overlay.tint = parseInt(String(color || '#000000').replace('#', ''), 16)
    overlay.width = this.width
    overlay.height = this.height
    overlay.alpha = 1
    overlay.visible = true

    const travelOffset = this._slideOffset(direction)
    // `direction` describes the direction in which the curtain travels.
    // An incoming curtain therefore starts at the opposite edge, while an
    // outgoing curtain finishes at the edge named by the direction.
    const incomingOffset = { x: -travelOffset.x, y: -travelOffset.y }
    const start = type === 'out' ? { x: 0, y: 0 } : incomingOffset
    const end = type === 'out' ? travelOffset : { x: 0, y: 0 }
    overlay.x = start.x
    overlay.y = start.y

    const delayMs = Math.max(0, Number(delay || 0)) * 1000
    const durationMs = Math.max(0, Number(duration || 0)) * 1000
    this._screenSlideTween = tweenOverlaySlide({
      overlay,
      token,
      isCurrent: t => t === this._screenSlideToken,
      durationMs,
      delayMs,
      start,
      end,
      nowMilliseconds,
      onFinish: () => {
        overlay.x = end.x
        overlay.y = end.y
        if (type === 'out') overlay.visible = false
      },
    })
  }

  _slideOffset(direction) {
    const dir = String(direction || '6')
    if (dir === '4') return { x: -this.width, y: 0 }
    if (dir === '8') return { x: 0, y: -this.height }
    if (dir === '2') return { x: 0, y: this.height }
    return { x: this.width, y: 0 }
  }

  clearScreenSlide() {
    this._screenSlideToken++
    this._screenSlideTween = null
    if (!this._slideOverlay || this._slideOverlay.destroyed) return
    this._slideOverlay.visible = false
    this._slideOverlay.x = 0
    this._slideOverlay.y = 0
  }

  cancelAllSpineTweens() {
    for (const entry of Object.values(this.spineInstances)) this._cancelActorTweens(entry)
  }

  // Native ADV placement (AdvStageLayout.js). `placement` is the IdolCharacter state: idol_position
  // (posX, posY), idol_zoom position (zoomX, zoomY) and size (zoom). IdolCharacter tweens position and zoom
  // linearly and independently; `position` / `zoom` give each one's { duration, delay } in seconds.
  placeActor(idolId, placement, { position = null, zoom = null, nowMilliseconds = () => performance.now() } = {}) {
    const actor = this._actor(idolId)
    if (!actor) return
    const target = {
      posX: Number(placement?.posX) || 0,
      posY: Number(placement?.posY) || 0,
      zoomX: Number(placement?.zoomX) || 0,
      zoomY: Number(placement?.zoomY) || 0,
      zoom: Number(placement?.zoom) > 0 ? Number(placement.zoom) : 1,
    }
    this._cancelActorTweens(actor)
    actor.adv = actor.adv ? { ...actor.adv } : { ...target }
    actor._advTweens = {}
    for (const [name, keys, transition] of [['position', ['posX', 'posY'], position], ['zoom', ['zoomX', 'zoomY', 'zoom'], zoom]]) {
      const from = Object.fromEntries(keys.map(key => [key, actor.adv[key]]))
      if (keys.every(key => from[key] === target[key])) continue
      const durationMs = Math.max(0, Number(transition?.duration) || 0) * 1000
      const delayMs = Math.max(0, Number(transition?.delay) || 0) * 1000
      if (durationMs <= 0 && delayMs <= 0) {
        for (const key of keys) actor.adv[key] = target[key]
        continue
      }
      const tween = runRafTween({
        durationMs,
        delayMs,
        nowMilliseconds,
        ease: t => t,
        onUpdate: value => {
          for (const key of keys) actor.adv[key] = from[key] + (target[key] - from[key]) * value
          this._layoutActor(actor)
        },
        onComplete: () => { if (actor._advTweens?.[name] === tween) delete actor._advTweens[name] },
      })
      actor._advTweens[name] = tween
    }
    this._layoutActor(actor)
  }

  // Spine entry, or the silhouette record (loaded sprite or pending load) for a texture figure.
  _actor(idolId) {
    return this.spineInstances[idolId] || this._silhouetteSprites[idolId] || this._silhouettePending[idolId] || null
  }

  _cancelActorTweens(actor) {
    for (const tween of Object.values(actor?._advTweens || {})) tween?.cancel?.()
    if (actor) actor._advTweens = {}
  }

  _layoutActor(actor) {
    const adv = actor?.adv
    if (!adv) return
    const slot = idolSlotPosition(adv)
    if (actor.spine) {
      if (actor.spine.destroyed) return
      const placed = skeletonFigureScreen(this.width, this.height, slot, actor.figure?.prefabY ?? 0, adv.zoom)
      actor.spine.position.set(placed.x, placed.y)
      actor.spine.scale.set(placed.scale)
    } else if (actor.sprite && !actor.sprite.destroyed) {
      const placed = textureFigureScreen(this.width, this.height, slot, actor.texture, actor.texture.positionY, adv.zoom)
      actor.sprite.position.set(placed.x, placed.y)
      actor.sprite.scale.set(placed.scale * actor.texture.image[1] / actor.sprite.texture.height)
    }
  }

  _layoutAllActors() {
    for (const entry of Object.values(this.spineInstances)) this._layoutActor(entry)
    for (const record of Object.values(this._silhouetteSprites)) this._layoutActor(record)
  }

  // Spine color tinting

  /**
   * Apply color tint to a spine model.
   * @param {string} idolId
   * @param {string|null} hexColor - "#FFFFFF" (normal), "#AAAAAA" (dim), null (reset)
   */
  setSpineColor(idolId, hexColor, duration = 0, delay = 0, nowMilliseconds) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const target = hexColor ? parseInt(hexColor.replace('#', ''), 16) : 0xFFFFFF
    const durationMs = Math.max(0, Number(duration || 0)) * 1000
    const delayMs = Math.max(0, Number(delay || 0)) * 1000
    this._spineColorTweens[idolId]?.cancel?.()
    delete this._spineColorTweens[idolId]
    const start = entry.spine.tint ?? 0xFFFFFF
    const startRgb = this._hexToRgb(start)
    const targetRgb = this._hexToRgb(target)
    if (durationMs > 0 || delayMs > 0) {
      const tween = runRafTween({
        nowMilliseconds,
        durationMs,
        delayMs,
        startValue: 0,
        endValue: 1,
        ease: easeOutCubic,
        onUpdate: (t) => {
          entry.spine.tint = this._rgbToHex({
            r: startRgb.r + (targetRgb.r - startRgb.r) * t,
            g: startRgb.g + (targetRgb.g - startRgb.g) * t,
            b: startRgb.b + (targetRgb.b - startRgb.b) * t,
          })
        },
        onComplete: () => {
          if (this._spineColorTweens[idolId] === tween) delete this._spineColorTweens[idolId]
        },
      })
      const cancel = tween.cancel
      tween.cancel = () => {
        cancel()
        if (this._spineColorTweens[idolId] === tween) delete this._spineColorTweens[idolId]
      }
      this._spineColorTweens[idolId] = tween
      return tween
    } else {
      entry.spine.tint = target
    }
  }
  setSpineScale(idolId, scale) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    if (!Number.isFinite(scale) || scale <= 0) return
    entry.spine.scale.set(scale)
    this._emitSpineState(idolId)
  }

  flushSpinePose(idolId, dt = 0) {
    const entry = this.spineInstances[idolId]
    const spine = entry?.spine
    if (!spine) return null
    try {
      spine.state.update(dt)
      spine.state.apply(spine.skeleton)
      spine.skeleton.updateWorldTransform()
      return true
    } catch (err) {
      console.warn(`[PixiStageManager] flushSpinePose failed for ${idolId}:`, err?.message || err)
      return false
    }
  }

  hasSilhouetteFallback(idolId, modelId = null) {
    const record = this._silhouetteSprites[idolId]
    const pending = this._silhouettePending[idolId]
    return !!(
      (record && (!modelId || record.modelId === modelId)) ||
      (pending && (!modelId || pending.modelId === modelId))
    )
  }

  // Texture figure (IdolFigureTexture): `texture` is its idol_figure_placement entry; the placement follows
  // placeActor. Without an entry the image is taken as the whole sprite rect at the default positionY.
  showSilhouette(idolId, modelId, texture = null, placement = {}, transitions = {}) {
    const existing = this._silhouetteSprites[idolId]
    if (existing && existing.modelId === modelId) {
      this.placeActor(idolId, placement, transitions)
      return
    }
    if (existing) this.removeSilhouette(idolId)

    const pending = this._silhouettePending[idolId]
    if (pending && pending.modelId === modelId) {
      this.placeActor(idolId, placement, transitions)
      return
    }

    const token = (this._silhouetteLoadTokens[idolId] || 0) + 1
    this._silhouetteLoadTokens[idolId] = token
    this._silhouettePending[idolId] = { token, modelId, texture }
    this.placeActor(idolId, placement)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = getSilhouetteUrl(modelId)
    img.onload = () => {
      const latest = this._silhouettePending[idolId]
      if (!latest || latest.token !== token) return
      delete this._silhouettePending[idolId]
      if (!this.spineContainer) return
      const bt = PIXI.BaseTexture.from(img)
      bt.alphaMode = PIXI.ALPHA_MODES.PMA
      const sprite = new PIXI.Sprite(PIXI.Texture.from(bt))
      sprite.anchor.set(0, 0)
      const record = {
        modelId,
        sprite,
        texture: latest.texture || { positionY: TEXTURE_FIGURE_POSITION_Y, size: [img.width, img.height], offset: [0, 0], image: [img.width, img.height] },
        adv: latest.adv,
        _advTweens: latest._advTweens,
      }
      this.spineContainer.addChild(sprite)
      this._silhouetteSprites[idolId] = record
      this._layoutActor(record)
    }
    img.onerror = () => {
      const latest = this._silhouettePending[idolId]
      if (!latest || latest.token !== token) return
      this._cancelActorTweens(latest)
      delete this._silhouettePending[idolId]
      if (!this._silhouetteSprites[idolId]) {
        this._silhouetteSprites[idolId] = null
      }
    }
  }

  removeSilhouette(idolId) {
    this._silhouetteLoadTokens[idolId] = (this._silhouetteLoadTokens[idolId] || 0) + 1
    this._cancelActorTweens(this._silhouettePending[idolId])
    delete this._silhouettePending[idolId]
    const record = this._silhouetteSprites[idolId]
    if (record) {
      this._cancelActorTweens(record)
      if (record.sprite.parent) record.sprite.parent.removeChild(record.sprite)
      try { record.sprite.destroy() } catch (_) {}
    }
    delete this._silhouetteSprites[idolId]
  }

  clearAllSilhouettes() {
    const idolIds = new Set([
      ...Object.keys(this._silhouetteSprites),
      ...Object.keys(this._silhouettePending),
    ])
    for (const idolId of idolIds) {
      this.removeSilhouette(idolId)
    }
  }

  // Spine loading

  async spawnSpine(idolId, modelId, options = {}) {
    if (this._destroyed || !this.app || options.isCurrent?.() === false) return null
    this.removeSpine(idolId)
    const spawnToken = (this._spawnTokens[idolId] || 0) + 1
    this._spawnTokens[idolId] = spawnToken
    const loadController = new AbortController()
    this._spawnLoads.set(idolId, loadController)
    const abortLoad = () => loadController.abort(options.signal.reason)
    options.signal?.addEventListener('abort', abortLoad, { once: true })
    if (options.signal?.aborted) abortLoad()

    const step = (name, fn) => {
      try {
        return fn()
      } catch (e) {
        console.error(`[spawnSpine] STEP "${name}" failed for ${modelId}:`, e)
        throw e
      }
    }

    try {
      const atlasUrl = getSpineAtlasUrl(modelId)
      const skelUrl = getSpineSkelUrl(modelId)
      const { skeletonData, spine, animNames, hasMeshOrRegion } = await step('loadAndCreateSpine', () => loadAndCreateSpine({
        modelId,
        atlasUrl,
        skelUrl,
        decodeAtlasText: buf => this._decodeAtlasText(buf),
        resolveTextureUrl: (mid, file, options) => this._resolveTextureUrl(mid, file, options),
        loadTextureFromUrl: (url, options) => this._loadTextureFromUrl(url, { ...options, allowFallback: false }),
        signal: loadController.signal,
        decodeSkelBuffer: buf => this._decodeSkelBuffer(buf),
        Spine,
        SkeletonBinary,
        AtlasAttachmentLoader,
        TextureAtlas,
      }))

      // Asset completion does not confer ownership of the current scene.
      // Dispose this unpublished object only; the idol ID may already belong
      // to a newer scene/model. Other callers can omit the scene predicate.
      if (this._destroyed || !this.app || this._spawnTokens[idolId] !== spawnToken || options.isCurrent?.() === false) {
        spine.destroy({ children: true, texture: false, baseTexture: false })
        return null
      }

      console.log(`[DEBUG] hasMeshOrRegion: ${hasMeshOrRegion}`)

      // Step snapshots and neck overlays are authored as cuts. A delayed
      // timeline body cue opts into its own 0.3s crossfade at dispatch time.
      spine.stateData.defaultMix = 0

      spine._faceEffectSlots = faceEffectSlots(spine.skeleton)
      spine._optionalPartsSlots = this._detectOptionalPartsSlots(spine, idolId, modelId)
      installNativeFramePose(spine, () => {
        hideFaceEffects(spine._faceEffectSlots, spine._faceFlags)
        this._applyOptionalPartsSlots(spine)
      })

      // Off-stage until finalize places the figure (placeActor / the default placement).
      spine.position.set(this.width / 2, this.height * 2)
      if (this._debugMode) console.debug('[SPAWN_DONE]', idolId, modelId, options.figure || null)

      spine.eventMode = this._debugMode ? 'dynamic' : 'none'
      spine.cursor = 'grab'

      spine.on('pointerdown', (event) => {
        this._dragSpineId = idolId
        spine.cursor = 'grabbing'
        spine.alpha = 0.8
        const pos = event.data.getLocalPosition(spine.parent)
        this._dragOffset = { x: spine.x - pos.x, y: spine.y - pos.y }
      })

      const onDragEnd = () => {
        if (this._dragSpineId !== idolId) return
        this._dragSpineId = null
        this._dragOffset = null
        spine.cursor = 'grab'
        spine.alpha = 1
        this._emitSpineState(idolId)
      }

      spine.on('pointerup', onDragEnd)
      spine.on('pointerupoutside', onDragEnd)

      if (!this._globalMoveHandler) {
        this._globalMoveHandler = (e) => {
          const dragId = this._dragSpineId
          if (!dragId || !this._dragOffset) return
          const entry = this.spineInstances[dragId]
          if (!entry) return
          const pos = e.data.getLocalPosition(entry.spine.parent)
          entry.spine.x = pos.x + this._dragOffset.x
          entry.spine.y = pos.y + this._dragOffset.y
          this._emitSpineState(dragId)
        }
        this.app.stage.on('globalpointermove', this._globalMoveHandler)
      }

      console.log(`[PixiStageManager] Spine "${modelId}" loaded. Anims:`, animNames.join(', '))

      if (!window.__spines) window.__spines = {}
      window.__spines[idolId] = spine
      window.__dumpSpine = (id) => {
        const s = id ? window.__spines[id] : Object.values(window.__spines)[0]
        if (!s) return console.log('No spine instance found')
        const sd = s.skeleton.data
        console.log('=== Slots ===')
        sd.slots.forEach((sl, i) => console.log(`  [${i}] ${sl.name} (bone: ${sl.bone.name}, defAtt: ${sl.attachmentName || '-'})`))
        console.log('=== Default Skin Attachments ===')
        if (sd.defaultSkin) {
          sd.defaultSkin.getAttachments().forEach(a => {
            const slotName = sd.slots[a.slotIndex]?.name || '?'
            console.log(`  slot=${slotName} attName='${a.name}' path='${a.attachmentName}'`)
          })
        }
      }

      finalizeSpawnedSpine({
        manager: this,
        spine,
        modelId,
        idolId,
        animNames,
        options,
        spawnToken,
        spineContainer: this.spineContainer,
        debugMode: this._debugMode,
        pendingTalking: this._pendingTalking,
        getDefaultBodyAnim: animNamesArg => this.getDefaultBodyAnim(animNamesArg),
        captureBaselineBounds: spawnedId => this.captureBaselineBounds(spawnedId),
        fadeIn: (spineObj, duration) => this._fadeIn(spineObj, duration),
        setSpineTalking: (spawnId, isTalking, volumeCallback) => this.setSpineTalking(spawnId, isTalking, volumeCallback),
      })
      return spine
    } catch (err) {
      if (this._destroyed) return null
      console.warn(`[PixiStageManager] Failed to load spine "${modelId}" for "${idolId}":`, err.message)
      return null
    } finally {
      options.signal?.removeEventListener('abort', abortLoad)
      if (this._spawnLoads.get(idolId) === loadController) this._spawnLoads.delete(idolId)
    }
  }
  _emitSpineState(idolId) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    window.dispatchEvent(new CustomEvent('spine-dragged', {
      detail: {
        id: idolId,
        x: Math.round(entry.spine.x),
        y: Math.round(entry.spine.y),
        scale: entry.spine.scale.x,
        modelId: entry.modelId,
      }
    }))
  }

  getDefaultBodyAnim(animNames = []) {
    if (!Array.isArray(animNames) || animNames.length === 0) return null
    if (animNames.includes('wait_loop')) return 'wait_loop'

    const loop = animNames.find(n =>
      typeof n === 'string' &&
      n.endsWith('_loop') &&
      !n.startsWith('face_') &&
      n !== 'angry_loop' &&
      n !== 'sad_loop' &&
      n !== 'joy_loop' &&
      n !== 'surprise_loop'
    )
    if (loop) return loop

    const nonFace = animNames.find(n => typeof n === 'string' && !n.startsWith('face_'))
    return nonFace || animNames[0] || null
  }

  captureBaselineBounds(idolId) {
    const entry = this.spineInstances[idolId]
    if (!entry?.spine) return null
    const spine = entry.spine
    const animNames = spine.state?.data?.skeletonData?.animations?.map(a => a.name) || []
    const defaultBody = this.getDefaultBodyAnim(animNames)
    if (!defaultBody) return null
    try {
      spine.state.setAnimation(0, defaultBody, true)
      spine._currentBodyAnim = defaultBody
      const defaultFace = animNames.includes('face_default')
        ? 'face_default'
        : (animNames.find(n => typeof n === 'string' && n.startsWith('face_')) || null)
      if (defaultFace) {
        spine.state.setAnimation(SPINE_TRACK.face, defaultFace, true)
        spine._currentFaceAnim = defaultFace
        spine._currentFaceKey = null
      }
      spine.state.update(0)
      spine.state.apply(spine.skeleton)
      this.flushSpinePose(idolId, 0)
      const baseline = this.getSkeletonLocalBounds(spine)
      entry.baselineSkeletonLocalBounds = baseline
      entry.baselineCapturedAt = new Date().toISOString()
      entry.baselineCaptureReason = 'spawn-default'
      entry.baselineBodyAnim = defaultBody
      entry.baselineFaceAnim = defaultFace
      entry.baselineTracks = Array.isArray(spine.state?.tracks)
        ? spine.state.tracks.map((track, index) => track ? {
          index,
          animation: track.animation?.name || null,
          loop: !!track.loop,
          trackTime: track.trackTime ?? null,
          mixTime: track.mixTime ?? null,
          mixDuration: track.mixDuration ?? null,
        } : null)
        : null
      return baseline
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to capture baseline bounds for "${idolId}":`, err?.message || err)
      return null
    }
  }

  /** Bring a spine to the front (top z-order). */
  bringToFront(idolId) {
    return this.spineManager?.bringToFront(idolId)
  }

  /** Apply an explicit back-to-front character order. */
  applySpineOrder(idolIds = []) {
    return this.spineManager?.applySpineOrder(idolIds)
  }

  _decodeSkelBuffer(buf) {
    const decoded=decodeUnitySpineSkeleton(buf)
    if(decoded!==buf)console.log(`[PixiStageManager] Stripped ${buf.byteLength-decoded.byteLength}-byte Unity header from .skel`)
    return decoded
  }
  // Atlas / texture helpers

  _decodeAtlasText(buf) {
    return decodeSpineAtlasText(buf)
  }

  _getTextureUrl(modelId, textureFile) {
    const atlasUrl = getSpineAtlasUrl(modelId)
    const base = atlasUrl.substring(0, atlasUrl.lastIndexOf('/'))
    return `${base}/${textureFile}`
  }

  async _resolveTextureUrl(modelId, textureFile, { allowFallback = true, signal } = {}) {
    return resolveSpineTextureUrl(modelId, textureFile, { allowFallback, signal,
      probe: url => this._isImageUrl(url, signal),
      onFallback: () => console.warn(`[PixiStageManager] Texture "${textureFile}" missing for "${modelId}", using comu.png`),
    })
  }

  async _isImageUrl(url, signal) {
    return withLoadDeadline(async requestSignal => {
      const response = await fetch(url, { method: 'HEAD', cache: 'default', signal: requestSignal })
      if ([404, 410].includes(response.status)) return false
      if (!response.ok) throw new Error(`Texture probe HTTP ${response.status}: ${url}`)
      return (response.headers.get('content-type') || '').startsWith('image/')
    }, { signal, timeoutMs: 10000, label: 'texture-probe' })
  }

  _loadTextureFromUrl(url, { allowFallback = true, signal, alphaMode } = {}) {
    const controller = new AbortController()
    const signals = [signal, this._textureOwner.signal].filter(Boolean)
    const abort = () => controller.abort(signals.find(item => item.aborted)?.reason)
    for (const item of signals) { item.addEventListener('abort', abort, { once: true }); if (item.aborted) abort() }
    return loadImageTexture(url, { allowFallback, signal: controller.signal, fallbackTexture: () => this._getFallbackTexture(),
      ...(alphaMode === undefined ? {} : { alphaMode }) })
      .finally(() => { for (const item of signals) item.removeEventListener('abort', abort) })
  }

  _getFallbackTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 64; canvas.height = 64
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ff00ff'
    ctx.fillRect(0, 0, 64, 64)
    const bt = PIXI.BaseTexture.from(canvas)
    bt.alphaMode = PIXI.ALPHA_MODES.PMA
    return PIXI.Texture.from(bt)
  }
  // Talking / Procedural Lip-Sync

  /**
   * Procedural lip-sync bridge.
   *
   * Delegates mouth/chin animation to LipSyncController after Spine state is applied.
   */
  setSpineTalking(idolId, isTalking, volumeCallback = null) {
    return this.lipSyncController.setTalking(idolId, isTalking, volumeCallback)
  }

  async _loadMouthSetting(idolId, spine) {
    return this.lipSyncController._loadMouthSetting(idolId, spine)
  }

  // Fade transitions

  /**
   * Fade a spine model in (alpha 0 -> 1) over ~300ms.
   * Fades the wrapper so the entire model blends as one layer.
   */
  setSpinePartsVisible(idolId, visible) {
    return this.spineManager?.setSpinePartsVisible(idolId, visible)
  }

  _detectOptionalPartsSlots(spine, idolId = '', modelId = '') {
    const skeleton = spine?.skeleton
    const data = skeleton?.data
    if (!data?.slots) return []

    const include = /(accessory|_acc|acc_|glasses?|beard|badge|cat|chain|necklace|bracelet|watch|ring|pierce|earring|ribbon|hat|cap|mask)/i
    const exclude = /(mouth|tooth|teeth|tongue|lip|eye|eyebrow|face|nose|cheek|sweat|blush|shadow|hair_base|body_base|skin)/i
    const attachmentBySlot = new Map()

    try {
      const attachments = data.defaultSkin?.getAttachments?.() || []
      for (const att of attachments) {
        const slotName = data.slots?.[att.slotIndex]?.name || ''
        const names = attachmentBySlot.get(slotName) || []
        names.push(att.name || att.attachmentName || '')
        attachmentBySlot.set(slotName, names)
      }
    } catch (_) {}

    const slots = []
    for (const slotData of data.slots) {
      const slotName = slotData?.name || ''
      const attNames = attachmentBySlot.get(slotName) || []
      const haystack = [slotName, slotData?.attachmentName || '', ...attNames].join(' ')
      if (!haystack || exclude.test(haystack)) continue
      if (include.test(haystack)) slots.push(slotName)
    }

    if (slots.length) {
      console.log(`[PixiStageManager] Optional parts for "${idolId}" (${modelId}):`, slots.join(', '))
    }
    return Array.from(new Set(slots))
  }

  _applyOptionalPartsSlots(spine) {
    if (!spine || typeof spine._partsVisible !== 'boolean') return
    const slotNames = spine._optionalPartsSlots || []
    if (!slotNames.length) return
    if (!spine._partsSlotAlpha) spine._partsSlotAlpha = {}

    for (const slotName of slotNames) {
      const slot = spine.skeleton?.findSlot?.(slotName)
      if (!slot) continue
      if (spine._partsSlotAlpha[slotName] == null) {
        const defaultAlpha = Number.isFinite(slot.data?.color?.a) ? slot.data.color.a : slot.color.a
        spine._partsSlotAlpha[slotName] = defaultAlpha
      }
      slot.color.a = spine._partsVisible ? spine._partsSlotAlpha[slotName] : 0
    }
  }
  _fadeIn(spine, duration = 0.3) {
    return this.spineManager?._fadeIn(spine, duration)
  }

  animateSpineAlpha(idolId, targetAlpha, duration = 0.2, delay = 0, nowMilliseconds) {
    return this.spineManager?.animateSpineAlpha(idolId, targetAlpha, duration, delay, nowMilliseconds)
  }

  /**
   * Fade out and destroy a spine wrapper as a single rendered layer.
   */
  _fadeOutWrapper(wrapper) {
    if (!wrapper || wrapper.destroyed) return

    // Keep the whole wrapper rendered as a single layer during fade-out.
    const alphaFilter = new PIXI.AlphaFilter(wrapper.alpha || 1.0)
    const previousFilters = Array.isArray(wrapper.filters) ? wrapper.filters.slice() : []
    wrapper.filters = [...previousFilters, alphaFilter]

    const STEP = 0.12  // roughly 8 frames at 60fps
    const ticker = () => {
      // Fade-out tick: reduce the wrapper alpha until it can be destroyed.
      if (wrapper.destroyed) {
        this.app.ticker.remove(ticker)
        return
      }

      alphaFilter.alpha -= STEP

      if (alphaFilter.alpha <= 0) {
        this.app.ticker.remove(ticker)
        wrapper.filters = previousFilters.length ? previousFilters : null
        const parent = wrapper.parent
        if (parent) parent.removeChild(wrapper)
        wrapper.destroy({ children: true, texture: false, baseTexture: false })
      }
    }
    this.app.ticker.add(ticker)
  }

  /**
   * Destroy a wrapper immediately, removing it from its parent first.
   */
  _destroyWrapperNow(wrapper) {
    if (!wrapper || wrapper.destroyed) return
    const parent = wrapper.parent
    if (parent) parent.removeChild(wrapper)
    wrapper.destroy({ children: true, texture: false, baseTexture: false })
  }

  _destroySpineMarker(idolId) {
    const entry = this.spineInstances[idolId]
    const marker = entry?.marker
    if (!marker || marker.destroyed) return
    const parent = marker.parent
    if (parent) parent.removeChild(marker)
    try {
      marker.destroy()
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to destroy debug marker for "${idolId}":`, err?.message || err)
    }
    if (entry) entry.marker = null
  }

  _cleanupDebugRefs(idolId) {
    if (typeof window === 'undefined') return
    if (window.__spines && idolId in window.__spines) {
      delete window.__spines[idolId]
    }
    if (window._s && idolId in window._s) {
      delete window._s[idolId]
    }
    if (window._probe && idolId in window._probe) {
      delete window._probe[idolId]
    }
  }

  _fadeOutAndDestroy(idolId, immediate = false) {
    this._spawnTokens[idolId] = (this._spawnTokens[idolId] || 0) + 1
    delete this._pendingTalking[idolId]
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const { spine, wrapper } = entry

    this._cancelActorTweens(entry)

    spine.customIsTalking = false
    this._destroySpineMarker(idolId)
    this._cleanupDebugRefs(idolId)
    delete this.spineInstances[idolId]

    if (immediate) this._destroyWrapperNow(wrapper || spine)
    else this._fadeOutWrapper(wrapper || spine)
  }

  _applyCloseEye(spine, closed, allAnims) {
    if (closed && allAnims.includes(EYE_CLOSE_ANIMATION)) {
      if (spine.state.getCurrent(EYE_TRACK)?.animation?.name !== EYE_CLOSE_ANIMATION) {
        spine.state.setAnimation(EYE_TRACK, EYE_CLOSE_ANIMATION, false).mixDuration = 0
      }
    } else if (spine.state.getCurrent(EYE_TRACK)?.animation?.name === EYE_CLOSE_ANIMATION) {
      // ResetCloseEye: an empty animation mixes eye_close out and restores the
      // eye attachments (clearTrack would leave the closed-eye attachments).
      spine.state.setEmptyAnimation(EYE_TRACK, 0)
    }
  }

  /**
   * Set facial expression via Track 2 animation, with original game engine flag control.
   *
   * SideM spine data includes `face_xxx` animations (for example `face_happy` and `face_angry`).
   *
   * @param {string} idolId
   * @param {string} faceName
   * @param {object|boolean} [faceFlags] - Flags from the RAW idol_face row:
   *   { anim_flag: '目' | 'off', blush_flag: 'チーク' | 'off', sweat_flag: '汗' | 'off' }
   *
   * anim_flag is the client's isEyeOff: 'off' holds eye_close on the eye track,
   * anything else clears it (eyes open).
   */
  updateSpineFace(idolId, faceName, faceFlags) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry
    try {
      // Normalize: ensure faceName starts with "face_"
      const animName = faceName.startsWith('face_') ? faceName : `face_${faceName}`
      const allAnims = spine.state.data.skeletonData.animations.map(a => a.name)
      const faceKey = faceFlags && typeof faceFlags === 'object'
        ? `${animName}|${faceFlags.anim_flag || ''}|${faceFlags.blush_flag || ''}|${faceFlags.sweat_flag || ''}`
        : `${animName}|||`
      // Include the original engine flags in the cache key so the same face can render differently by flags.
      if (faceFlags && typeof faceFlags === 'object') {
        spine._faceFlags = {
          anim_flag: faceFlags.anim_flag || '',
          blush_flag: faceFlags.blush_flag || '',
          sweat_flag: faceFlags.sweat_flag || '',
        }
      }

      if (allAnims.includes(animName)) {
        if (spine._currentFaceKey === faceKey) return
        const trackEntry = spine.state.setAnimation(SPINE_TRACK.face, animName, true)
        spine._currentFaceAnim = animName
        spine._currentFaceKey = faceKey
        if (trackEntry) {
          trackEntry.mixAttachmentThreshold = 0.0
          trackEntry.mixDuration = 0
        }
        // Client idol_face [3] is isEyeOff (== "off"): IdolCharacter.CoPlayAnimation
        // calls PlayCloseEye (eye_close held on the eye track) for "off" and
        // ResetCloseEye (empty eye track) otherwise; "\u76EE" therefore means open eyes.
        if (faceFlags && typeof faceFlags === 'object') this._applyCloseEye(spine, faceFlags.anim_flag === 'off', allAnims)
      } else {
        // Fallback: clear Track 2 to show the default skeleton face
        console.warn(`[PixiStageManager] Face anim "${animName}" not found on "${entry.modelId}", clearing track`)
        spine.state.clearTrack(SPINE_TRACK.face)
        spine._currentFaceAnim = null
        spine._currentFaceKey = null
      }
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to set face "${faceName}" on "${idolId}":`, err.message)
    }
  }
  /**
   * Animate spine.x to a target over ~300ms using requestAnimationFrame.
   * Cancels any previous tween on this spine. Designed for slot-layout transitions.
   */
  _tweenX(entry, targetX) {
    entry._tween?.cancel?.()
    const startX = entry.spine.x
    const dx = targetX - startX
    const duration = 280
    entry._tween = runRafTween({
      durationMs: duration,
      startValue: startX,
      endValue: targetX,
      ease: easeOutCubic,
      onUpdate: (x) => {
        entry.spine.x = x
      },
      onComplete: () => {
        entry._tween = null
      },
    })
  }

  setSpineAlpha(idolId, alpha) {
    return this.spineManager?.setSpineAlpha(idolId, alpha)
  }

  bringSpineToTop(idolId) {
    return this.spineManager?.bringSpineToTop(idolId)
  }

  /**
   * Play an animation on Track 0 (body) with automatic loop chaining.
   *
   * Convention (from SideM spine data):
   *   - Animations with a `_loop` suffix are looping (e.g. `wait_loop`, `angry_loop`).
   *   - Most emotional actions have a paired loop: `angry` é”?`angry_loop`.
   *   - Single-shot animations (e.g. `neck_yes`, `neck_no`) have no `_loop` variant
   *     and should fall back to `wait_loop`.
   */
  playSpineAnim(idolId, animName, skipChain = false, noBack = false, motionSetting = null, forceRestart = false, transitionMix = null, motionTable = null, trackTime = 0) {
    return this.spineManager?.playSpineAnim(idolId, animName, skipChain, noBack, motionSetting, forceRestart, transitionMix, motionTable, trackTime)
  }

  /**
   * Instant body animation switch with no crossfade.
   * Used for timeline events that need a clean snap-cut.
   */
  switchSpineAnim(idolId, animName) {
    return this.spineManager?.switchSpineAnim(idolId, animName)
  }

  playSpineNeckAnim(idolId, animName, eventKey = '', trackTime = 0) {
    return this.spineManager?.playSpineNeckAnim(idolId, animName, eventKey, trackTime)
  }

  stopSpineNeckAnim(idolId, eventKey = '') {
    return this.spineManager?.stopSpineNeckAnim(idolId, eventKey)
  }

  /**
   * Remove a spine model with a fade-out transition.
   * The model fades out over ~12 frames then destroys itself.
   */
  removeSpine(idolId, immediate = false) {
    this._spawnLoads.get(idolId)?.abort()
    this._spawnLoads.delete(idolId)
    this._spineColorTweens[idolId]?.cancel?.()
    this.removeSilhouette(idolId)
    return this.spineManager?.removeSpine(idolId, immediate)
  }

  clearAllSpines(options = {}) {
    for (const controller of this._spawnLoads.values()) controller.abort()
    this._spawnLoads.clear()
    Object.values(this._spineColorTweens).forEach(tween => tween.cancel?.())
    this.clearAllSilhouettes()
    return this.spineManager?.clearAllSpines(options)
  }

  inspectReleaseState() {
    const overlayState = overlay => ({
      exists: Boolean(overlay && !overlay.destroyed),
      visible: Boolean(overlay && !overlay.destroyed && overlay.visible),
      alpha: overlay && !overlay.destroyed ? Number(overlay.alpha || 0) : 0,
    })
    const overlays = {
      fade: overlayState(this._fadeOverlay),
      slide: overlayState(this._slideOverlay),
      effect: overlayState(this._effectOverlay),
    }
    return {
      destroyed: this._destroyed,
      stage_children: this.app?.stage?.children?.length ?? 0,
      spine_container_children: this.spineContainer?.children?.length ?? 0,
      debug_markers: this._debugOverlay?.children?.length ?? 0,
      // Texture figures re-run the native layout synchronously on resize; nothing is deferred.
      silhouette_relayout_jobs: 0,
      overlays: {
        ...overlays,
        active_count: Object.values(overlays).filter(overlay => overlay.visible && overlay.alpha > 0).length,
      },
    }
  }

  destroy() {
    if (this._destroyed) return
    this._destroyed = true
    this._textureOwner.abort()
    if (this._visibilityHandler) document.removeEventListener('visibilitychange', this._visibilityHandler)
    this._visibilityHandler = null
    this.screenEffects?.destroy()
    this.screenEffects = null
    this._dragSpineId = null
    if (this._globalMoveHandler && this.app) {
      this.app.stage.off('globalpointermove', this._globalMoveHandler)
      this._globalMoveHandler = null
    }
    if (this._debugMarkerUpdater && this.app?.ticker) {
      this.app.ticker.remove(this._debugMarkerUpdater)
      this._debugMarkerUpdater = null
    }
    this.clearAllSpines({ immediate: true })
    if (this._debugOverlay) {
      this._debugOverlay.destroy({ children: true })
      this._debugOverlay = null
    }
    this._resizeObserver?.disconnect()
    this._resizeObserver = null
    this.cameraController?.destroy()
    this.cameraColorFilter?.destroy()
    this.idolColorFilter?.destroy()
    this.cameraController = null
    this.backgroundManager?.destroy()
    this.backgroundManager = null
    if (this.app) {
      this.app.destroy(true)
      this.app = null
    }
  }
}
