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
import { easeOutCubic, runRafTween } from './rafTween.js'
import { tweenOverlayFade, tweenOverlayPunch, tweenOverlaySlide } from './transitionTweens.js'
import { loadAndCreateSpine } from './spineSpawnPipeline.js'
import { finalizeSpawnedSpine } from './spineSpawnFinalize.js'
import { BackgroundManager } from './BackgroundManager.js'
import { CameraController } from './CameraController.js'
import { SpineManager } from './SpineManager.js'
import { fitSpineToPrefabRect as fitSpineToPrefabRectUtil, getPrefabRectMetrics as getPrefabRectMetricsUtil } from './spinePrefabFit.js'
import { LipSyncController } from './LipSyncController.js'
import { cancelBlinkCover } from './spineBlinkCover.js'
import { detectBlinkSlots } from './spineBlinkSlots.js'

const ADULT_BASE_SCALE = 0.26
const SUB_BASE_SCALE = 0.235

// Per-character default scale calibration.
// Do not infer this directly from idol_zoom counts: many scenarios apply
// idol_zoom as scene direction, and it must not be multiplied a second time.
const CHARACTER_BASE_SCALE_MULTIPLIER = {
  '037jir': 1.3,
}

// livecharacter bodyType is a broad body class, not an ADV portrait scale.
// Keep this subtle; native rig art and idolothersetting carry most of the
// visible height/position differences.
const BODY_TYPE_SCALE_MULTIPLIER = {
  1: 1.00,
  2: 1.025,
  3: 0.975,
  4: 0.94,
  5: 0.90,
}

// Model-level visual calibration is only for proven outliers. Keep empty by
// default; original bodyType + otherSetting should do the general work.
const MODEL_BASE_SCALE_MULTIPLIER = {}
const DEFAULT_ADULT_SCALE = ADULT_BASE_SCALE
const DEFAULT_SUB_SCALE = SUB_BASE_SCALE

export class PixiStageManager {
  constructor(containerEl, options = {}) {
    this.container = containerEl
    this.width = options.width || containerEl.clientWidth || 1280
    this.height = options.height || containerEl.clientHeight || 720

    this.app = null
    this.spineInstances = {}   // { idolId: { spine: Spine, modelId: string, marker: Graphics } }
    this._spawnTokens = {}
    this._silhouetteSprites = {}  // { idolId: PIXI.Sprite } — fallback for missing Spine assets
    this._silhouettePending = {}  // { idolId: { token, modelId, posX, posY, baseY } }
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
    this._screenEffectToken = 0

    // Visual filters
    this._grayFilter = null     // PIXI.ColorMatrixFilter for grayscale
    this._blurFilter = null     // PIXI.BlurFilter for bg DOF
    this._bgOverlaySprite = null  // color overlay sprite for bg_color
    this._bgBlurAmount = 0
    this._bgOverlayColor = 0xFFFFFF
    this._spineColorTweens = {}
    this._cameraflareTextures = null
    this._effectTextureCache = {}

    this._init()
    this._observeResize()
  }

  _init() {
    this.app = new PIXI.Application({
      width: this.width,
      height: this.height,
      backgroundColor: 0x000000,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })
    this.container.appendChild(this.app.view)

    // Layer structure: bgContainer (bottom) -> spineContainer -> fadeOverlay (top)
    this.bgContainer = new PIXI.Container()
    this.bgEffectContainer = new PIXI.Container()
    this.spineContainer = new PIXI.Container()
    this.app.stage.addChild(this.bgContainer)
    this.app.stage.addChild(this.bgEffectContainer)
    this.app.stage.addChild(this.spineContainer)
    this.backgroundManager = new BackgroundManager({
      app: this.app,
      bgContainer: this.bgContainer,
      bgEffectContainer: this.bgEffectContainer,
      getWidth: () => this.width,
      getHeight: () => this.height,
      getBgUrl,
      loadTextureFromUrl: url => this._loadTextureFromUrl(url),
    })
    this.cameraController = new CameraController({
      bgContainer: this.bgContainer,
      spineContainer: this.spineContainer,
      getWidth: () => this.width,
      getHeight: () => this.height,
      getBgSprite: () => this.bgSprite,
    })
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
    this._debugMarkerUpdater = () => {
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

  _observeResize() {
    this._resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          this.width = width
          this.height = height
          this.app.renderer.resize(width, height)
          this.backgroundManager?.handleResize()
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
          // Spines stay at their current positions on resize (user may have dragged them)
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
    const prefabMeta = entry.prefabMeta || null
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
    const positioning = entry.positioning || {}
    const targetY = positioning.targetY ?? entry.targetVisualBottom ?? null
    const baselineBottomOffset = positioning.baselineBottomOffset ?? ((entry.baselineSkeletonLocalBounds || localBounds) ? ((entry.baselineSkeletonLocalBounds || localBounds).bottom * spine.scale.x) : null)
    const currentBottomOffset = positioning.currentBottomOffset ?? ((skeletonLocalBounds || localBounds) ? ((skeletonLocalBounds || localBounds).bottom * spine.scale.x) : null)
    const rootOffset = positioning.rootOffset ?? baselineBottomOffset
    const finalRootY = positioning.finalRootY ?? spine.y
    const offsetStrengthUsed = positioning.offsetStrengthUsed ?? null
    const pivotY = positioning.pivotY ?? prefabMeta?.pivotY ?? prefabMeta?.derived?.pivotY ?? null
    const isPivotOutlier = !!positioning.isPivotOutlier
    const baselineBottomError = targetY != null && baselineBottomOffset != null && finalRootY != null
      ? ((finalRootY + baselineBottomOffset) - targetY)
      : null
    const currentBottomError = targetY != null && currentBottomOffset != null && finalRootY != null
      ? ((finalRootY + currentBottomOffset) - targetY)
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
      scale: {
        base: spine._baseScale || null,
        current: spine.scale.x,
        bodyTypeScale: entry.scaleConfig?.bodyTypeScale ?? null,
        charaScale: entry.scaleConfig?.charaScale ?? null,
        modelScale: entry.scaleConfig?.modelScale ?? null,
        visualHeightReference: entry.scaleConfig?.visualHeightReference ?? null,
        visualHeightStrength: entry.scaleConfig?.visualHeightStrength ?? null,
        visualHeightScale: entry.scaleConfig?.visualHeightScale ?? null,
        bodyScaleEnabled: !!entry.scaleConfig?.bodyScaleEnabled,
        fitMode: entry.scaleConfig?.fitMode || 'current',
      },
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
      prefabMeta: prefabMeta ? {
        prefabPositionY: prefabMeta?.derived?.prefabPositionY ?? null,
        estimatedRectBottomY: prefabMeta?.derived?.estimatedRectBottomY ?? null,
        pivotY: prefabMeta?.derived?.pivotY ?? null,
        sizeDeltaY: prefabMeta?.derived?.sizeDeltaY ?? null,
        rectFit: spine._prefabRectFit || null,
      } : null,
      positioning: {
        positionMode: entry.positionMode || null,
        targetY,
        targetVisualBottom: targetY,
        baselineBottomOffset,
        currentBottomOffset,
        rootOffset,
        offsetStrengthUsed,
        pivotY,
        isPivotOutlier,
        finalRootY,
        baselineBottomError,
        currentBottomError,
      },
      prefabMetrics: entry.prefabMetrics || null,
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

  setBgBlur(amount, duration = 0, delay = 0) {
    return this.backgroundManager?.setBgBlur(amount, duration, delay)
  }

  _ensureBgBlurFilter() {
    return this.backgroundManager?._ensureBgBlurFilter()
  }

  setBgBlurInstant(amount) {
    return this.backgroundManager?.setBgBlurInstant(amount)
  }

  clearBgBlur() {
    return this.backgroundManager?.clearBgBlur()
  }

  setBgColorOverlay(hexColor, duration = 0, delay = 0) {
    return this.backgroundManager?.setBgColorOverlay(hexColor, duration, delay)
  }

  clearBgColorOverlay() {
    return this.backgroundManager?.clearBgColorOverlay()
  }

  _hexToRgb(color) {
    return this.backgroundManager?._hexToRgb(color)
  }

  _rgbToHex(rgb) {
    return this.backgroundManager?._rgbToHex(rgb)
  }

  applyBgEffects(effects = [], bgProfile = null) {
    return this.backgroundManager?.applyBgEffects(effects, bgProfile)
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
   * Apply camera color filter to the entire stage.
   * @param {string|null} filter - 'gray', 'sepia_light', or null to clear.
   */
  setCameraFilter(filter) {
    if (filter === 'gray') {
      if (!this._grayFilter) {
        this._grayFilter = new PIXI.ColorMatrixFilter()
        this._grayFilter.padding = 0
      }
      this._grayFilter.resolution = this.app.renderer.resolution
      this._grayFilter.multisample = PIXI.MSAA_QUALITY.MEDIUM
      this._grayFilter.matrix = [
        0.58, 0.26, 0.08, 0, 0,
        0.12, 0.76, 0.08, 0, 0,
        0.08, 0.20, 0.58, 0, 0,
        0,    0,    0,    1, 0,
      ]
      this.app.stage.filters = [this._grayFilter]
    } else if (filter === 'sepia_light') {
      if (!this._grayFilter) {
        this._grayFilter = new PIXI.ColorMatrixFilter()
        this._grayFilter.padding = 0
      }
      this._grayFilter.resolution = this.app.renderer.resolution
      this._grayFilter.multisample = PIXI.MSAA_QUALITY.MEDIUM
      // Light warm archive tone: keep enough saturation that costume colors remain readable.
      this._grayFilter.matrix = [
        0.90, 0.12, 0.02, 0, 0,
        0.06, 0.94, 0.02, 0, 0,
        0.03, 0.08, 0.78, 0, 0,
        0,    0,    0,    1, 0,
      ]
      this.app.stage.filters = [this._grayFilter]
    } else {
      this.app.stage.filters = null
    }
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
  setScreenFade(type, color, duration, delay = 0, maxAlpha = 1) {
    const token = ++this._screenFadeToken
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
      tweenOverlayFade({
        overlay: this._fadeOverlay,
        token,
        isCurrent: t => t === this._screenFadeToken,
        durationMs: dur,
        delayMs,
        startAlpha,
        endAlpha,
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
    if (!this._fadeOverlay || this._fadeOverlay.destroyed) return
    this._fadeOverlay.alpha = 0
    this._fadeOverlay.visible = false
  }

  playScreenEffects(effects = []) {
    if (!Array.isArray(effects) || effects.length === 0 || !this._effectOverlay) return
    const token = ++this._screenEffectToken
    for (const effect of effects) {
      const delayMs = Math.max(0, Number(effect?.delay || 0)) * 1000
      setTimeout(() => {
        if (token !== this._screenEffectToken) return
        if (effect?.type === 'single') this._playSingleScreenEffect(effect)
        else this._playFadeScreenEffect(effect)
      }, delayMs)
    }
  }

  _playFadeScreenEffect(effect) {
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
    tweenOverlayFade({
      overlay,
      token: this._screenEffectToken,
      isCurrent: token => token === this._screenEffectToken,
      durationMs,
      startAlpha,
      endAlpha,
      onFinish: () => {
        if (endAlpha <= 0 && overlay && !overlay.destroyed) overlay.visible = false
      },
    })
  }

  _playSingleScreenEffect(effect) {
    const id = effect?.id || ''
    if (id === 'fx_adv_punch') {
      this._playPunchEffect(effect)
    } else if (id === 'fx_adv_kamifubuki') {
      this._playKamifubukiEffect(effect)
    } else if (id === 'fx_adv_sakura' || id === 'fx_adv_momiji') {
      this._playFallingScreenTexture(id, effect)
    }
  }

  _playPunchEffect(effect) {
    const overlay = this._effectOverlay
    if (!overlay || overlay.destroyed) return
    this._playPunchTexture(effect)
    overlay.tint = 0xffffff
    overlay.width = this.width
    overlay.height = this.height
    overlay.alpha = 0.3
    overlay.visible = true
    const dir = Math.sign(Number(effect?.x || 0))
    const durationMs = Math.max(120, Number(effect?.duration || 0.35) * 1000)
    tweenOverlayPunch({
      overlay,
      spineContainer: this.spineContainer,
      durationMs,
      dir: dir || 1,
    })
  }

  _loadEffectTexture(name) {
    if (!this._effectTextureCache[name]) {
      this._effectTextureCache[name] = this._loadTextureFromUrl(`/data/fx_extracted/unity_${name}.png`)
    }
    return this._effectTextureCache[name]
  }

  async _playPunchTexture(effect) {
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
      const start = performance.now()
      const tick = () => {
        if (token !== this._screenEffectToken || sprite.destroyed) {
          this.app?.ticker?.remove(tick)
          if (!sprite.destroyed) sprite.destroy()
          return
        }
        const t = Math.min((performance.now() - start) / durationMs, 1)
        const frame = Math.min(5, Math.floor(t * 6))
        const fx = frame % 3
        const fy = Math.floor(frame / 3)
        sprite.texture = new PIXI.Texture(base, new PIXI.Rectangle(fx * frameWidth, fy * frameHeight, frameWidth, frameHeight))
        sprite.alpha = 1 - Math.max(0, t - 0.25) / 0.75
        sprite.scale.set(scale * (0.92 + t * 0.18))
        if (t >= 1) {
          this.app.ticker.remove(tick)
          sprite.destroy()
        }
      }
      this.app.ticker.add(tick)
    } catch (err) {
      console.warn('[PixiStageManager] Failed to load punch texture:', err?.message || err)
    }
  }

  _playKamifubukiEffect(effect) {
    this._playFallingScreenTexture('fx_adv_sakura', effect, {
      count: 48,
      duration: Math.max(0.8, Number(effect?.duration || 1.1)),
      useStar: true,
    })
    this._playFadeScreenEffect({ type: 'fadein', color: '#FFFFFF', alpha: 0.18, duration: 0.1 })
    this._playFadeScreenEffect({ type: 'fadeout', color: '#FFFFFF', alpha: 0.18, duration: 0.28 })
  }

  async _playFallingScreenTexture(id, effect, options = {}) {
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
        sprite.rotation = (i * 0.77) % Math.PI
        sprite._fxSeed = i * 131
        sprite._fxSpeed = 0.7 + ((i * 11) % 30) / 20
        container.addChild(sprite)
        sprites.push(sprite)
      }
      const durationMs = Math.max(300, Number(options.duration || effect?.duration || 1) * 1000)
      const start = performance.now()
      const tick = () => {
        if (token !== this._screenEffectToken || container.destroyed) {
          this.app?.ticker?.remove(tick)
          if (!container.destroyed) container.destroy({ children: true })
          return
        }
        const elapsed = performance.now() - start
        const progress = Math.min(elapsed / durationMs, 1)
        for (const sprite of sprites) {
          const seed = sprite._fxSeed || 0
          const drift = elapsed / 1000 * sprite._fxSpeed
          sprite.x = ((seed * 17 + drift * 260) % (this.width + 180)) - 90 + Math.sin(drift * 4 + seed) * 28
          sprite.y = ((seed * 9 + drift * 390) % (this.height + 180)) - 120
          sprite.rotation += 0.035 * sprite._fxSpeed
          sprite.alpha = (0.72 - progress * 0.42) * (0.75 + ((seed % 17) / 50))
        }
        if (progress >= 1) {
          this.app.ticker.remove(tick)
          container.destroy({ children: true })
        }
      }
      this.app.ticker.add(tick)
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to load screen effect "${id}":`, err?.message || err)
    }
  }

  setScreenSlide(type, color = '#000000', duration = 0.5, delay = 0, direction = '6') {
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
    tweenOverlaySlide({
      overlay,
      token,
      isCurrent: t => t === this._screenSlideToken,
      durationMs,
      delayMs,
      start,
      end,
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
    if (!this._slideOverlay || this._slideOverlay.destroyed) return
    this._slideOverlay.visible = false
    this._slideOverlay.x = 0
    this._slideOverlay.y = 0
  }

  cancelAllSpineTweens() {
    for (const entry of Object.values(this.spineInstances)) {
      if (entry?._slideTweenRaf) {
        cancelAnimationFrame(entry._slideTweenRaf)
        entry._slideTweenRaf = null
      }
    }
  }
  // Spine position animation (slide)

  /**
   * Animate a spine from its current position to target position.
   * @param {string} idolId
   * @param {number} targetX - target screen X
   * @param {number} targetY - target screen Y
   * @param {number} duration - animation duration in seconds
   */
  animateSpinePosition(idolId, targetX, targetY, duration) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry

    // Cancel previous tween on this spine
    if (entry._slideTweenRaf) {
      cancelAnimationFrame(entry._slideTweenRaf)
      entry._slideTweenRaf = null
    }

    const startX = spine.x
    const startY = spine.y
    const dx = targetX - startX
    const dy = targetY - startY
    const durMs = duration * 1000

    if (durMs <= 0 || (dx === 0 && dy === 0)) {
      spine.x = targetX
      spine.y = targetY
      return
    }

    const t0 = performance.now()
    const tick = () => {
      const elapsed = performance.now() - t0
      const t = Math.min(elapsed / durMs, 1)
      const ease = 1 - Math.pow(1 - t, 3)  // easeOutCubic
      spine.x = startX + dx * ease
      spine.y = startY + dy * ease
      if (t < 1) {
        entry._slideTweenRaf = requestAnimationFrame(tick)
      } else {
        entry._slideTweenRaf = null
      }
    }
    entry._slideTweenRaf = requestAnimationFrame(tick)
  }
  // Spine color tinting

  /**
   * Apply color tint to a spine model.
   * @param {string} idolId
   * @param {string|null} hexColor - "#FFFFFF" (normal), "#AAAAAA" (dim), null (reset)
   */
  setSpineColor(idolId, hexColor, duration = 0, delay = 0) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const target = hexColor ? parseInt(hexColor.replace('#', ''), 16) : 0xFFFFFF
    const durationMs = Math.max(0, Number(duration || 0)) * 1000
    const delayMs = Math.max(0, Number(delay || 0)) * 1000
    this._spineColorTweens[idolId]?.cancel?.()
    const start = entry.spine.tint ?? 0xFFFFFF
    const startRgb = this._hexToRgb(start)
    const targetRgb = this._hexToRgb(target)
    if (durationMs > 0 || delayMs > 0) {
      this._spineColorTweens[idolId] = runRafTween({
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
          delete this._spineColorTweens[idolId]
        },
      })
    } else {
      entry.spine.tint = target
    }
  }
  // Character zoom (idol_zoom multiplier)

  /**
   * Apply character-specific zoom multiplier to base scale.
   * Stores the base scale (calculated from model type) and applies zoom factor.
   */
  setSpineZoom(idolId, zoomMultiplier) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const baseScale = entry.spine._baseScale || entry.spine.scale.x
    if (zoomMultiplier != null && zoomMultiplier > 0) {
      entry.spine.scale.set(baseScale * zoomMultiplier)
    } else {
      entry.spine.scale.set(baseScale)
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

  getPrefabRectMetrics(spine, prefabMeta) {
    return getPrefabRectMetricsUtil(spine, prefabMeta)
  }

  fitSpineToPrefabRect(spine, prefabMeta, options = {}) {
    return fitSpineToPrefabRectUtil(spine, prefabMeta, this.height, options)
  }
  // Silhouette fallback for missing Spine assets (NPC/non-idol characters)

  _layoutSilhouette(sprite, sourceWidth, sourceHeight, posX = 0, posY = 0, baseY = null) {
    const stageW = this.width || 1280
    const stageH = this.height || 720
    const baseX = stageW / 2 + posX * (stageW / 1280)
    const baseYPos = baseY ?? Math.round(stageH * 0.62)
    sprite.x = baseX
    sprite.y = baseYPos + 25 + posY * (stageW / 1280)
    const silScale = (stageH * 1.02) / sourceHeight
    sprite.scale.set(silScale)
  }

  hasSilhouetteFallback(idolId, modelId = null) {
    const sprite = this._silhouetteSprites[idolId]
    const pending = this._silhouettePending[idolId]
    return !!(
      (sprite && (!modelId || sprite._silhouetteModelId === modelId)) ||
      (pending && (!modelId || pending.modelId === modelId))
    )
  }

  showSilhouette(idolId, modelId, posX = 0, posY = 0, baseY = null) {
    const existing = this._silhouetteSprites[idolId]
    if (existing && existing._silhouetteModelId === modelId) {
      const source = existing.texture?.baseTexture?.resource?.source
      this._layoutSilhouette(
        existing,
        source?.naturalWidth || source?.width || existing.texture.width,
        source?.naturalHeight || source?.height || existing.texture.height,
        posX,
        posY,
        baseY,
      )
      return
    }
    if (existing) this.removeSilhouette(idolId)

    const pending = this._silhouettePending[idolId]
    if (pending && pending.modelId === modelId) {
      Object.assign(pending, { posX, posY, baseY })
      return
    }

    const token = (this._silhouetteLoadTokens[idolId] || 0) + 1
    this._silhouetteLoadTokens[idolId] = token
    this._silhouettePending[idolId] = { token, modelId, posX, posY, baseY }
    const url = getSilhouetteUrl(modelId)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = url
    img.onload = () => {
      const latest = this._silhouettePending[idolId]
      if (!latest || latest.token !== token) return
      delete this._silhouettePending[idolId]
      if (!this.spineContainer) return
      // Remove any stale sprite for this idol
      const old = this._silhouetteSprites[idolId]
      if (old) {
        if (old.parent) old.parent.removeChild(old)
        try { old.destroy() } catch (_) {}
      }
      const bt = PIXI.BaseTexture.from(img)
      bt.alphaMode = PIXI.ALPHA_MODES.PMA
      const texture = PIXI.Texture.from(bt)
      const sprite = new PIXI.Sprite(texture)
      sprite.anchor.set(0.5, 1.0)
      sprite._silhouetteModelId = modelId
      this._layoutSilhouette(sprite, img.width, img.height, latest.posX, latest.posY, latest.baseY)
      this.spineContainer.addChild(sprite)
      this._silhouetteSprites[idolId] = sprite
    }
    img.onerror = () => {
      const latest = this._silhouettePending[idolId]
      if (!latest || latest.token !== token) return
      delete this._silhouettePending[idolId]
      if (!this._silhouetteSprites[idolId]) {
        this._silhouetteSprites[idolId] = null
      }
    }
  }

  removeSilhouette(idolId) {
    this._silhouetteLoadTokens[idolId] = (this._silhouetteLoadTokens[idolId] || 0) + 1
    delete this._silhouettePending[idolId]
    const sprite = this._silhouetteSprites[idolId]
    if (sprite) {
      if (sprite.parent) sprite.parent.removeChild(sprite)
      try { sprite.destroy() } catch (_) {}
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
    this.removeSpine(idolId)
    const spawnToken = (this._spawnTokens[idolId] || 0) + 1
    this._spawnTokens[idolId] = spawnToken

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
        extractTextureFilename: atlasText => this._extractTextureFilename(atlasText),
        resolveTextureUrl: (mid, file) => this._resolveTextureUrl(mid, file),
        loadTextureFromUrl: url => this._loadTextureFromUrl(url),
        getFallbackTexture: () => this._getFallbackTexture(),
        decodeSkelBuffer: buf => this._decodeSkelBuffer(buf),
        Spine,
        SkeletonBinary,
        AtlasAttachmentLoader,
        TextureAtlas,
      }))

      console.log(`[DEBUG] hasMeshOrRegion: ${hasMeshOrRegion}`)

      spine.stateData.defaultMix = 0.12

      const origStateUpdate = spine.state.update.bind(spine.state)
      spine.state.update = (dt) => {
        origStateUpdate(dt)
        for (let i = 0; i <= 1; i++) {
          const track = spine.state.tracks[i]
          if (!track || track.alpha <= 0 || track.alpha >= 1 || track.mixDuration <= 0) continue
          const t = track.alpha
          if (i === 0) {
            const smoothstep = t * t * (3 - 2 * t)
            track.alpha = t * 0.5 + smoothstep * 0.5
          } else {
            const c1 = 5.0
            const c3 = c1 + 1
            track.alpha = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
          }
        }
      }

      spine._blinkCfg = this._detectBlinkSlots(spine)
      spine._effectCfg = this._detectEffectSlots(spine)
      spine._optionalPartsSlots = this._detectOptionalPartsSlots(spine, idolId, modelId)

      const origApply = spine.state.apply.bind(spine.state)
      spine.state.apply = (skeleton) => {
        origApply(skeleton)

        const blinkCfg = spine._blinkCfg
        if (blinkCfg) {
          const now = performance.now()
          const blinking = spine._blinkCoverEndTime && now < spine._blinkCoverEndTime
          if (blinking) {
            if (!spine._savedEyeAtts) {
              spine._savedEyeAtts = {}
              for (const name of blinkCfg.hide) {
                const slot = skeleton.findSlot(name)
                if (slot) spine._savedEyeAtts[name] = slot.attachment?.name || null
              }
            }
            for (const name of blinkCfg.hide) {
              try { skeleton.setAttachment(name, null) } catch (_) {}
            }
            for (const item of blinkCfg.show) {
              try { skeleton.setAttachment(item.slot, item.att) } catch (_) {}
            }
          } else if (spine._savedEyeAtts) {
            for (const [slotName, attName] of Object.entries(spine._savedEyeAtts)) {
              if (attName) {
                try { skeleton.setAttachment(slotName, attName) } catch (_) {}
              }
            }
            for (const item of blinkCfg.show) {
              try { skeleton.setAttachment(item.slot, null) } catch (_) {}
            }
            spine._savedEyeAtts = null
            spine._blinkCoverEndTime = undefined
          } else {
            spine._blinkCoverEndTime = undefined
          }
        }

        const effectCfg = spine._effectCfg
        const eFlags = spine._faceFlags || {}
        if (effectCfg && effectCfg.blush.length > 0 && eFlags.blush_flag !== '¥Á©`¥¯') {
          for (const name of effectCfg.blush) {
            const slot = skeleton.findSlot(name)
            if (slot) slot.color.a = 0
          }
        }
        if (effectCfg && effectCfg.sweat.length > 0 && eFlags.sweat_flag !== 'º¹') {
          for (const name of effectCfg.sweat) {
            const slot = skeleton.findSlot(name)
            if (slot) slot.color.a = 0
          }
        }
        this._applyOptionalPartsSlots(spine)
      }

      if (this._spawnTokens[idolId] !== spawnToken) {
        spine.destroy({ children: true, texture: false, baseTexture: false })
        return null
      }

      this._applyDefaultPosition(spine, modelId, idolId, options)
      console.warn('[SPAWN_DONE]', idolId, modelId, {
        x: spine.x,
        y: spine.y,
        baseScale: spine._baseScale || spine.scale.x,
      })

      if (!spine._baseScale) {
        spine._baseScale = spine.scale.x
      }

      const marker = new PIXI.Graphics()
      marker.beginFill(0xff0000)
      marker.drawCircle(0, 0, 8)
      marker.endFill()
      marker.beginFill(0xffffff)
      marker.drawCircle(0, 0, 3)
      marker.endFill()
      marker.visible = this._debugMode
      this._debugOverlay?.addChild(marker)

      spine.eventMode = 'dynamic'
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
        const cfg = s._blinkCfg
        console.log('=== BlinkCfg ===', cfg ? JSON.stringify(cfg, null, 2) : 'null')
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
      console.warn(`[PixiStageManager] Failed to load spine "${modelId}" for "${idolId}":`, err.message)
      return null
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
        spine.state.setAnimation(1, defaultFace, true)
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

  _applyDefaultPosition(spine, modelId = '', idolId = '', options = {}) {
    // Keep character height differences from the original rigs.  Normalizing by
    // skeleton.data.height made taller idols look artificially smaller because
    // some rigs include different whitespace/bounds.
    const isSubModel = /^\d{3}sub_/.test(modelId)
    const fitMode = (options.fitMode || 'current').toLowerCase()
    const bodyScaleEnabled = !!options.bodyScaleEnabled
    const baseScale = isSubModel ? DEFAULT_SUB_SCALE : DEFAULT_ADULT_SCALE
    const charaScale = CHARACTER_BASE_SCALE_MULTIPLIER[idolId] || 1
    const bodyTypeScale = bodyScaleEnabled ? (BODY_TYPE_SCALE_MULTIPLIER[options.bodyType] || 1) : 1
    const modelScale = MODEL_BASE_SCALE_MULTIPLIER[modelId] || 1
    const visualHeightReference = Number.isFinite(options.visualHeightReference) ? options.visualHeightReference : null
    const visualHeightStrength = Number.isFinite(options.visualHeightStrength) ? options.visualHeightStrength : 1
    let visualHeightScale = 1
    let finalScale = baseScale

    if (fitMode === 'visualheight' && visualHeightReference && visualHeightReference > 0) {
      try {
        const local = spine.getLocalBounds()
        if (local && Number.isFinite(local.height) && local.height > 0) {
          visualHeightScale = Math.pow(visualHeightReference / local.height, visualHeightStrength)
        }
      } catch (_) {
        visualHeightScale = 1
      }
    }

    if (fitMode === 'current') {
      finalScale = baseScale * charaScale * bodyTypeScale * modelScale
      spine.scale.set(finalScale)
      spine.y = this.app.screen.height + 20
    } else if (fitMode === 'fixedscale') {
      finalScale = baseScale * bodyTypeScale
      spine.scale.set(finalScale)
      spine.y = this.app.screen.height + 20
    } else if (fitMode === 'visualheight') {
      finalScale = baseScale * visualHeightScale * bodyTypeScale
      spine.scale.set(finalScale)
      spine.y = this.app.screen.height + 20
    } else if (fitMode === 'prefabrect') {
      const fit = this.fitSpineToPrefabRect(spine, options.prefabMeta)
      if (fit) {
        finalScale = fit.scale
      } else {
        finalScale = baseScale * bodyTypeScale
        spine.scale.set(finalScale)
      }
      spine.y = Number.isFinite(spine.y) ? spine.y : this.app.screen.height + 20
    } else {
      finalScale = baseScale * charaScale * bodyTypeScale * modelScale
      spine.scale.set(finalScale)
      spine.y = this.app.screen.height + 20
    }
    spine.x = this.app.screen.width * 0.5
    spine._scaleConfig = {
      fitMode,
      bodyScaleEnabled,
      baseScale,
      charaScale,
      bodyTypeScale,
      modelScale,
      visualHeightReference,
      visualHeightStrength,
      visualHeightScale,
      finalScale,
    }
    return spine._scaleConfig
  }

  setSpinePosition(idolId, positionIdx) {
    return this.spineManager?.setSpinePosition(idolId, positionIdx)
  }

  /**
   * Position a spine using native game coordinates (-200, 0, 200, etc.).
   * The game's native canvas is ~1280é”?20; maps offsets to current screen size.
   * @param {string} idolId
   * @param {number} posX - native x offset (e.g. -200 = left position)
   * @param {number} [posY=0] - native y offset
   * @param {number} [baseY] - base Y in virtual coords (use getCharaY result)
   */
  setSpinePositionByGameCoord(idolId, posX, posY = 0, baseY = null) {
    return this.spineManager?.setSpinePositionByGameCoord(idolId, posX, posY, baseY)
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
    const view = new DataView(buf)
    const nameLen = view.getUint32(0, true)
    // Unity binary header: uint32 filenameLength + filename + padding + uint32 metadata
    if (nameLen > 0 && nameLen < 100) {
      let printable = true
      for (let i = 0; i < nameLen; i++) {
        const b = view.getUint8(4 + i)
        if (b < 0x20 || b > 0x7e) { printable = false; break }
      }
      if (printable) {
        // Name section: 4 (length) + nameLen + padding to uint32 boundary
        const nameSection = 4 + nameLen + ((4 - (4 + nameLen) % 4) % 4)
        // Unity metadata uint32 follows name section (file size or block type)
        const headerSize = nameSection + 4
        console.log(`[PixiStageManager] Stripped ${headerSize}-byte Unity header from .skel`)
        return buf.slice(headerSize)
      }
    }
    return buf
  }
  // Atlas / texture helpers

  _decodeAtlasText(buf) {
    const text = new TextDecoder('utf-8').decode(buf)
    const sizeIdx = text.indexOf('\nsize:')
    if (sizeIdx < 0) return text
    const lineStart = text.lastIndexOf('\n', sizeIdx - 1)
    if (lineStart < 0) return text
    const atlasText = text.substring(lineStart + 1)
    const firstLine = atlasText.split('\n')[0].trim()
    if (!firstLine || firstLine.includes(':')) return text
    return atlasText
  }

  _extractTextureFilename(atlasText) {
    const lines = atlasText.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.includes(':') && !trimmed.startsWith('//')) {
        return trimmed.split('/').pop()
      }
    }
    return 'comu.png'
  }

  /**
  /**
   * Detect blink-related slots from skeleton slot names.
   */
  _detectBlinkSlots(spine) {
    const config = detectBlinkSlots(spine)
    if (config) console.log('[BlinkCfg]', config)
    return config
  }

  /**
   * Detect effect slots (blush/sweat) from slot names.
   */
  _detectEffectSlots(spine) {
    const blush = []
    const sweat = []
    const slotNames = spine?.skeleton?.data?.slots?.map(s => s.name) || []
    for (const name of slotNames) {
      const low = String(name).toLowerCase()
      if (/cheek/.test(low)) blush.push(name)
      if (/^swet\b/.test(low) || /^sweat\b/.test(low)) sweat.push(name)
    }
    const result = { blush, sweat }
    if (blush.length > 0 || sweat.length > 0) console.log("[EffectCfg]", result)
    return result
  }

  _getTextureUrl(modelId, textureFile) {
    const atlasUrl = getSpineAtlasUrl(modelId)
    const base = atlasUrl.substring(0, atlasUrl.lastIndexOf('/'))
    return `${base}/${textureFile}`
  }

  async _resolveTextureUrl(modelId, textureFile) {
    const primaryUrl = this._getTextureUrl(modelId, textureFile)
    if (await this._isImageUrl(primaryUrl)) return primaryUrl

    if (textureFile !== 'comu.png') {
      const fallbackUrl = this._getTextureUrl(modelId, 'comu.png')
      if (await this._isImageUrl(fallbackUrl)) {
        console.warn(`[PixiStageManager] Texture "${textureFile}" missing for "${modelId}", using comu.png`)
        return fallbackUrl
      }
    }

    return primaryUrl
  }

  async _isImageUrl(url) {
    try {
      const r = await fetch(url, { method: 'HEAD', cache: 'no-store' })
      if (!r.ok) return false
      const contentType = r.headers.get('content-type') || ''
      return contentType.startsWith('image/')
    } catch (_) {
      return false
    }
  }

  _loadTextureFromUrl(url) {
    return new Promise(resolve => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = url
      img.onload = () => {
        const bt = PIXI.BaseTexture.from(img)
        bt.alphaMode = PIXI.ALPHA_MODES.PMA
        const onReady = () => resolve(PIXI.Texture.from(bt))
        if (bt.valid) {
          onReady()
        } else {
          bt.once('update', onReady)
          setTimeout(() => {
            if (!bt.valid) {
              console.warn(`[PixiStageManager] Texture timeout: ${url}`)
              resolve(PIXI.Texture.from(bt))
            }
          }, 10000)
        }
      }
      img.onerror = () => {
        console.warn(`[PixiStageManager] Failed to load texture: ${url}`)
        resolve(this._getFallbackTexture())
      }
    })
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

  animateSpineAlpha(idolId, targetAlpha, duration = 0.2, delay = 0) {
    return this.spineManager?.animateSpineAlpha(idolId, targetAlpha, duration, delay)
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

    // Cancel slide tween if active
    if (entry._slideTweenRaf) {
      cancelAnimationFrame(entry._slideTweenRaf)
      entry._slideTweenRaf = null
    }

    spine.customIsTalking = false
    this._destroySpineMarker(idolId)
    this._cleanupDebugRefs(idolId)
    delete this.spineInstances[idolId]

    if (immediate) this._destroyWrapperNow(wrapper || spine)
    else this._fadeOutWrapper(wrapper || spine)
  }

  /**
   * Set facial expression via Track 1 animation, with original game engine flag control.
   *
   * SideM spine data includes `face_xxx` animations (for example `face_happy` and `face_angry`).
   *
   * @param {string} idolId
   * @param {string} faceName
   * @param {object|boolean} [faceFlags] - Flags from original data, or boolean shouldBlink for backward compat.
   *   { anim_flag: 'ç›?|'off', blush_flag: 'ãƒãƒ¼ã‚?|'off', sweat_flag: 'æ±?|'off' }
   *
    * faceFlags.anim_flag controls blink cover timing. 'off' keeps the switch instant; 'ç›? or
   * an unknown value applies a ~150ms blink cover.
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

      // A rapid step change can interrupt the temporary blink cover. Restore
      // its open-eye attachments before replacing or reusing the face track.
      cancelBlinkCover(spine)

      if (allAnims.includes(animName)) {
        if (spine._currentFaceKey === faceKey) return
        const trackEntry = spine.state.setAnimation(1, animName, true)
        spine._currentFaceAnim = animName
        spine._currentFaceKey = faceKey
        if (trackEntry) {
          trackEntry.mixAttachmentThreshold = 0.0
          spine._blinkCoverEndTime = 0

          if (faceFlags && typeof faceFlags === 'object' && faceFlags.anim_flag === 'off') {
            // off means the switch is instant, without blink masking.
            spine._blinkCoverEndTime = 0
            spine._savedEyeAtts = null
            trackEntry.mixDuration = 0.05
          } else if (faceFlags && typeof faceFlags === 'object' && faceFlags.anim_flag === '\u76EE') {
            // anim_flag === '\u76EE': cover the blink for about 150ms.
            spine._blinkCoverEndTime = performance.now() + 150
            spine._savedEyeAtts = null
            trackEntry.mixDuration = 0
          } else {
            // Unknown or missing flag: use the safe blink-cover transition.
            spine._blinkCoverEndTime = performance.now() + 150
            spine._savedEyeAtts = null
            trackEntry.mixDuration = 0
          }
        }
      } else {
        // Fallback: clear Track 1 to show the default skeleton face
        console.warn(`[PixiStageManager] Face anim "${animName}" not found on "${entry.modelId}", clearing track`)
        spine.state.clearTrack(1)
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
  playSpineAnim(idolId, animName, skipChain = false, noBack = false, motionSetting = null) {
    return this.spineManager?.playSpineAnim(idolId, animName, skipChain, noBack, motionSetting)
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry
    try {
      const allAnims = spine.state.data.skeletonData.animations.map(a => a.name)
      if (spine._currentBodyAnim === animName) return

      if (animName.endsWith('_loop')) {
        // Already a loop animation é”?play directly
        spine.state.setAnimation(0, animName, true)
      } else if (skipChain || noBack) {
        // Single-shot, no auto-chain é”?used when step has timeline
        spine.state.setAnimation(0, animName, false)
      } else {
        // Single-shot animation: play once, then chain the official pose loop.
        const loopVariant = animName + '_loop'
        const officialPose = motionSetting?.pose || ''
        const fallback = officialPose && allAnims.includes(officialPose)
          ? officialPose
          : allAnims.includes(loopVariant)
            ? loopVariant
            : 'wait_loop'

        spine.state.setAnimation(0, animName, false)
        if (allAnims.includes(fallback)) {
          spine.state.addAnimation(0, fallback, true, 0)
        }
      }
      spine._currentBodyAnim = animName
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to play anim "${animName}" on "${idolId}":`, err.message)
    }
  }

  /**
   * Instant body animation switch with no crossfade.
   * Used for timeline events that need a clean snap-cut.
   */
  switchSpineAnim(idolId, animName) {
    return this.spineManager?.switchSpineAnim(idolId, animName)
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry
    try {
      const allAnims = spine.state.data.skeletonData.animations.map(a => a.name)
      if (!allAnims.includes(animName)) {
        console.warn(`[PixiStageManager] Anim "${animName}" not found on "${entry.modelId}"`)
        return
      }
      const isLoop = animName.endsWith('_loop')
      const savedMix = spine.stateData.defaultMix
      spine.stateData.defaultMix = 0.3  // 300ms é”?smooth timeline anim transitions
      spine.state.setAnimation(0, animName, isLoop)
      spine._currentBodyAnim = animName
      spine.stateData.defaultMix = savedMix
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to switch anim "${animName}" on "${idolId}":`, err.message)
    }
  }

  playSpineNeckAnim(idolId, animName) {

    // Disabled: neck animation on Track 3 can freeze poses; see notes below.
    // See ADV_STATE_MACHINE_NOTES.md for the intended snap-cut behavior.
    /* Original code preserved below for reference:
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry
    try {
      const allAnims = spine.state.data.skeletonData.animations.map(a => a.name)
      if (!allAnims.includes(animName)) {
        console.warn(`[PixiStageManager] Neck anim "${animName}" not found on "${entry.modelId}"`)
        return
      }
      if (spine._currentNeckAnim === animName) return
      const track = spine.state.setAnimation(3, animName, false)
      spine._currentNeckAnim = animName
      if (track) {
        const listener = { complete: () => { spine.state.setEmptyAnimation(3, 0.25); spine._currentNeckAnim = null } }
        track.listener = listener
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to play neck anim "${animName}" on "${idolId}":`, err.message)
    }
    */
  }

  stopSpineNeckAnim(idolId) {
    // Disabled: see playSpineNeckAnim for the reason this is not active.
    /* original code:
    /* original code:
    const entry = this.spineInstances[idolId]
    try {
      entry.spine.state.setEmptyAnimation(3, 0.25)
      entry.spine._currentNeckAnim = null
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to stop neck anim on "${idolId}":`, err.message)
    }
    */
  }

  /**
   * Remove a spine model with a fade-out transition.
   * The model fades out over ~12 frames then destroys itself.
   */
  removeSpine(idolId, immediate = false) {
    this.removeSilhouette(idolId)
    return this.spineManager?.removeSpine(idolId, immediate)
  }

  clearAllSpines() {
    this.clearAllSilhouettes()
    return this.spineManager?.clearAllSpines()
    this.lipSyncController.clearPending()
    this._pendingTalking = this.lipSyncController.pendingTalking
    // Reset camera zoom/pan
    this.resetCameraZoom()
    // Collect wrappers before clearing the map to avoid stale callbacks.
    // Prevent an older fade-out from removing a newer model with the same idolId.
    const wrappers = []
    for (const idolId of Object.keys(this.spineInstances)) {
      this._spawnTokens[idolId] = (this._spawnTokens[idolId] || 0) + 1
      const entry = this.spineInstances[idolId]
      delete this.spineInstances[idolId]
      if (entry) {
        if (entry.spine) entry.spine.customIsTalking = false
        if (entry._slideTweenRaf) {
          cancelAnimationFrame(entry._slideTweenRaf)
          entry._slideTweenRaf = null
        }
        if (entry.marker) {
          const marker = entry.marker
          if (marker.parent) marker.parent.removeChild(marker)
          try {
            marker.destroy()
          } catch (err) {
            console.warn(`[PixiStageManager] Failed to destroy debug marker during clearAllSpines for "${idolId}":`, err?.message || err)
          }
          entry.marker = null
        }
        this._cleanupDebugRefs(idolId)
        wrappers.push(entry.wrapper || entry.spine)
      }
    }

    for (const wrapper of wrappers) {
      this._fadeOutWrapper(wrapper)
    }
  }

  destroy() {
    this._dragSpineId = null
    if (this._globalMoveHandler && this.app) {
      this.app.stage.off('globalpointermove', this._globalMoveHandler)
      this._globalMoveHandler = null
    }
    if (this._debugMarkerUpdater && this.app?.ticker) {
      this.app.ticker.remove(this._debugMarkerUpdater)
      this._debugMarkerUpdater = null
    }
    if (this._debugOverlay) {
      this._debugOverlay.destroy({ children: true })
      this._debugOverlay = null
    }
    this._resizeObserver?.disconnect()
    this._resizeObserver = null
    this.clearAllSpines()
    this.cameraController?.destroy()
    this.cameraController = null
    this.backgroundManager?.destroy()
    this.backgroundManager = null
    if (this.app) {
      this.app.destroy(true)
      this.app = null
    }
  }
}
