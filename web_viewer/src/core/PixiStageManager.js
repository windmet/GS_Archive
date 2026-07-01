/**
 * PixiStageManager 锟?manages the PixiJS canvas/renderer and stage graph.
 *
 * Spine loading strategy (SideM-specific):
 *   DO NOT use PIXI.Assets / @pixi-spine/loader-3.8 for Spine loading.
 *   The loader doesn't handle SideM's Unity-exported Spine 3.8 assets correctly.
 *
 *   Instead, manually load everything like the SSR_Portraits project:
 *   1. Fetch .atlas 锟?text (skip Unity binary header)
 *   2. Fetch .skel 锟?ArrayBuffer
 *   3. Load .png 锟?PIXI.Texture with ALPHA_MODES.PMA forced
 *   4. Construct TextureAtlas with a callback that maps texture filenames
 *   5. AtlasAttachmentLoader + SkeletonBinary 锟?SkeletonData
 *   6. new Spine(skeletonData)
 *
 * Debug features:
 *   - Drag any spine to reposition visually (for calibration)
 *   - Red origin marker at each spine (0,0) so you can find it even
 *     when scale/position sends the texture off-screen
 *   - Scale +/- via changeSpineScale()
 */

import * as PIXI from 'pixi.js'
import { Spine, SkeletonBinary, AtlasAttachmentLoader } from '@pixi-spine/runtime-3.8'
import { TextureAtlas } from '@pixi-spine/base'
import { getBgUrl, getMouthSettingUrl, getSpineAtlasUrl, getSpineSkelUrl } from '../utils/AssetResolver.js'
import { easeOutCubic, runRafTween } from './rafTween.js'
import { tweenOverlayFade, tweenOverlayPunch, tweenOverlaySlide } from './transitionTweens.js'
import { loadAndCreateSpine } from './spineSpawnPipeline.js'
import { finalizeSpawnedSpine } from './spineSpawnFinalize.js'
import { BackgroundManager } from './BackgroundManager.js'
import { fitSpineToPrefabRect as fitSpineToPrefabRectUtil, getPrefabRectMetrics as getPrefabRectMetricsUtil } from './spinePrefabFit.js'
import { LipSyncController } from './LipSyncController.js'

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
    this._pendingTalking = {}
    this.lipSyncController = new LipSyncController({
      getSpineEntry: idolId => this.spineInstances[idolId],
      getMouthSettingUrl,
    })
    this._pendingTalking = this.lipSyncController.pendingTalking
    this._debugMode = false

    // Camera zoom/pan state
    this._cameraZoom = null      // {zoom, offsetX, offsetY, duration} from step state
    this._cameraTweenRaf = null  // rAF handle for zoom animation
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

    // Layer structure: bgContainer (bottom) 锟?spineContainer 锟?fadeOverlay (top)
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

  applyBgEffects(effects = []) {
    return this.backgroundManager?.applyBgEffects(effects)
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
        if (effectCfg && effectCfg.blush.length > 0 && eFlags.blush_flag !== '闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣椤愯姤鎱ㄥ鍡楀⒒闁绘帞鏅幉鎼佸籍閸ヮ煈妫ㄥ┑锛勫亼閸婃牕煤瀹ュ纾婚柟鎯х摠閸欏繐鈹戦悩鍙夊櫤妞ゃ儱顦伴妵鍕箻閸愬弶鍊悗鍨緲鐎氼厾鎹㈠┑瀣闁割煈鍊ｅ┑鍡忔斀闁绘灏欏Λ鍕煛婢跺﹦姘ㄩ柛瀣崌瀵挳濮€閻樼數鏋冮梺纭呭亹鐞涖儵宕滃┑鍫㈡／?') {
          for (const name of effectCfg.blush) {
            const slot = skeleton.findSlot(name)
            if (slot) slot.color.a = 0
          }
        }
        if (effectCfg && effectCfg.sweat.length > 0 && eFlags.sweat_flag !== '锟?') {
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
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry
    const POSITION_X_RATIOS = { 0: 0.25, 1: 0.5, 2: 0.75 }
    if (positionIdx != null && POSITION_X_RATIOS[positionIdx] !== undefined) {
      spine.x = this.width * POSITION_X_RATIOS[positionIdx]
    } else {
      spine.x = this.width * 0.5
    }
    spine.y = this.height + 20
  }

  /**
   * Position a spine using native game coordinates (-200, 0, 200, etc.).
   * The game's native canvas is ~1280锟?20; maps offsets to current screen size.
   * @param {string} idolId
   * @param {number} posX - native x offset (e.g. -200 = left position)
   * @param {number} [posY=0] - native y offset
   * @param {number} [baseY] - base Y in virtual coords (use getCharaY result)
   */
  setSpinePositionByGameCoord(idolId, posX, posY = 0, baseY = null) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    if (entry._slideTweenRaf) {
      cancelAnimationFrame(entry._slideTweenRaf)
      entry._slideTweenRaf = null
    }
    const centerX = this.width / 2
    const yBase = baseY != null ? baseY : this.height + 20
    // Scale native coords (1280-wide canvas) to current screen width
    const coordScale = this.width / 1280
    entry.spine.x = centerX + posX * coordScale
    // Negate posY: game uses Unity convention (Y+ = up), web/PixiJS has Y+ = down
    entry.spine.y = yBase - posY * coordScale
  }

  /** Bring a spine to the front (top z-order). */
  bringToFront(idolId) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    this.spineContainer.setChildIndex(entry.wrapper, this.spineContainer.children.length - 1)
  }

  /** Apply an explicit back-to-front character order. */
  applySpineOrder(idolIds = []) {
    const orderedEntries = []
    for (const idolId of idolIds) {
      const entry = this.spineInstances[idolId]
      if (entry?.wrapper?.parent === this.spineContainer) {
        orderedEntries.push(entry)
      }
    }
    orderedEntries.forEach((entry, index) => {
      this.spineContainer.setChildIndex(entry.wrapper, index)
    })
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
    const hide = []
    const show = []
    const skin = spine?.skeleton?.data?.defaultSkin
    const slotNames = spine?.skeleton?.data?.slots?.map(s => s.name) || []
    for (const name of slotNames) {
      const low = String(name).toLowerCase()
      const idx = spine?.skeleton?.data?.findSlotIndex?.(name) ?? -1
      if (idx < 0) continue
      if (/_close/.test(low)) {
        let attName = name
        if (skin?.attachments?.[idx]) {
          const keys = Object.keys(skin.attachments[idx])
          const closeKey = keys.find(k => /close/i.test(k))
          attName = closeKey ?? keys[0] ?? ""
        }
        try {
          const testAtt = skin?.getAttachment?.(idx, attName) || spine.skeleton.getAttachment(idx, attName)
          if (testAtt) show.push({ slot: name, att: attName })
        } catch (_) {}
      } else if (/_smile/.test(low) || /^(eyelash|eyewhite|eyelight|eyeline|eye_pupil|eyeball)/.test(low) || /eyeball.*skin/.test(low)) {
        hide.push(name)
      }
    }
    if (hide.length === 0 && show.length === 0) return null
    console.log("[BlinkCfg]", { slotCount: slotNames.length, hide, show })
    return { hide, show }
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
   * 缂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾剧懓顪冪€ｎ亝鎹ｉ柣顓炴閵嗘帒顫濋敐鍛婵＄偑鍊戦崹娲偋閻樿尙鏆﹂柕濞炬櫅缁犺銇勯幘璺烘瀾婵炲懎鐗撳缁樻媴閸涘﹤鏆堟繛鎾寸椤ㄥ﹤鐣疯ぐ鎺戝瀭妞ゆ劧绲藉鍧楁⒑閹勭闁稿鐒︾粋宥咁煥閸喓鍘甸梺璇″瀻閸愵厼鐓橀梻浣筋嚙缁诲棝寮插┑鍫燁潟闁圭儤顨呴悞鍨亜閹哄棗浜鹃梺浼欑稻缁诲牆鐣烽悢纰辨晢闁稿本鑹剧粻浼存⒑鐠囧弶鍞夋い顐㈩樀楠炴牠鍩￠崨顓犵崶闂佸搫绋侀崑鈧柛瀣尭椤繈鎮℃惔锛勭潉闁诲孩顔栭崰妤佺箾婵犲洨宓佹俊顖濆亹绾惧吋淇婇婵囥€冮柣銏㈢帛缁绘繈鎮介棃娴躲垽鏌ㄩ弴妯衡偓鏇＄亱濠德板€曢幊蹇涘磹閸啔褰掓偐瀹割喖鍓遍梺缁樻尰濞茬喖寮婚弴鐔虹闁割煈鍠栨慨銏㈢磽娴ｅ壊妲洪柛搴涘€濋妴鍐Ψ閳哄倸鈧兘鏌熺紒妯虹瑲婵炲牐顕ц灃闁绘﹢娼ф禒锕傛煥閺囨ê鐏查柣娑卞櫍瀹曞爼濡搁敃鈧鎾绘煟閻斿摜鎳冮悗姘ュ姂閸┾偓妞ゆ巻鍋撻柛鐔告綑椤繒绱掑Ο鑲╂嚌闂侀€炲苯澧い顓炴穿椤﹀綊鎸婂┑鍥ヤ簻闁规儳宕悘鈺冪棯閹规劖纭堕柍褜鍓濋～澶娒洪弽顬℃椽濡搁埡鍌氬壒濠殿喗顭堥崺鏍偂閺囩姵鍠愰幖娣妸閳ь剙鍟村畷鍗炩槈濞嗗繋锟?(Procedural Lip-Sync Engine).
   *
   * 闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕濡ょ姷鍋涢ˇ鐢稿极閹剧粯鍋愭い鎰枎娴滈箖鏌ㄩ弴鐐测偓鎼佹倷婵犲啨浜滈柟鍝勬娴滃墽绱撴担鐟板妞ゃ劌锕濠氭偄閻撳海顔夐梺閫涘嵆濞佳冣枔椤撶姷纾藉ù锝呮惈鏍￠梺缁橆殕濞茬喖宕洪悙鍝勭闁挎棁妫勬禍褰掓⒑閸涘﹦鎳冩い锔诲灦钘濋柍鍝勬噺閳锋垿鏌涘┑鍡楊仾濠殿垰銈搁弻娑㈠箻閺夋垵鎽靛Δ鐘靛仜閻楁挻淇婇幖浣肝ㄩ柕蹇婂墲閺夋悂姊绘担铏广€婇柛鎾寸箞閹兘濡烽敂钘夊妳婵犻潧鍊婚…鐜€ Spine 濠电姷鏁告慨鐑藉极閸涘﹥鍙忛柣鎴濐潟閳ь剙鍊块幐濠冪珶閳哄绉€规洏鍔戝鍫曞箣濠靛牃鍋撻鐑嗘富闁靛牆鎳愮粻浼存煟濡も偓濡繈骞冮悙鍝勫瀭妞ゆ劗濮崇花濠氭⒑閻熺増鎯堟俊顐ｎ殕缁傚秹宕滆绾惧ジ鏌涢幘妤€妫欓妤呮⒑閸涘﹦鎳冮柛鐔告綑閻ｅ嘲煤椤忓嫮鍔﹀銈嗗笂闂勫秵绂嶅鍫熺厵闁告繂瀚ˉ婊兠瑰鍫㈢暫婵﹥妞介獮鏍倷閼碱兛鐥梻浣虹帛閹碱偆鎹㈠┑鍡欐殾婵炲樊浜滈～鍛存煥濞戞ê顏存繛鏉戝閺岋絾鎯旈婊呅ｆ繛瀛樼矌閸嬨倕鐣峰┑瀣妞ゆ棁袙閹锋椽姊洪崨濠勨槈闁挎洏鍊栭幈銊╁焵椤掑嫭鈷戦柛婵嗗閸ｈ櫣绱掔拠鑼ⅵ妤犵偛鍟妶锝夊礃閳哄倸鍔掓俊鐐€栭崝褏妲愰弴鐘典笉婵﹩鍓﹀〒濠氭煏閸繃顥滃┑顔ㄥ懐纾奸柟缁樺笒閳锋梹绻涢崱鎰伈鐎殿喖顭锋俊鐑芥晝閳ь剟鍩€椤掆偓閻忔岸骞堥妸銉庣喖鎮℃惔鈥茬帛濠电姭鎷冮崘鎯ф闂侀€炲苯澧叉い顐㈩槸鐓ら柡宥庡幖缁犺銇勯幇鈺佸姢濞存粍鐟╁缁樻媴閸涘﹤鏆堟繛鎾寸椤ㄥ﹤鐣锋导鏉戝唨妞ゆ挾鍋熼ˇ顓烆渻閵堝棙灏柛銊︽そ閸╂盯骞嬮敂鐣屽幈濠电偞鍨堕敃顐﹀绩鐠囧樊鐔嗛悹鍝勬惈椤忣參鏌＄仦鍓ф创闁轰焦鍔栭幆鏃堝焺閸愵亜缍嗛梺璇叉唉椤煤閻斿鐒界憸鏃堝春閵夛箑绶為柟閭﹀墻濞煎﹪姊洪悙钘夊姎闁告ɑ鐗犲畷鐘诲冀椤撶啿鎷绘繛杈剧秬椤宕戦悩缁樼厱閹兼惌鍠栭悘锔锯偓瑙勬礃缁诲啴骞嗛弮鍫熸櫜闁搞儻濡囬悷婵嬫⒒娴ｅ憡璐￠柛瀣崌瀵憡绺界粙璺ㄥ摋闂佸吋浜介崕顖涚濠婂牊鐓涢柛鎰╁妽缁佲晜绻涢崗鐓庡缂佺粯鐩畷銊╊敇閵娿劌鎯堥梻?talk/mouth clip),
   * 闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕閻庤娲忛崕鎶藉焵椤掑﹦绉靛ù婊冪埣閹垽宕卞Ο璇插伎濠碉紕鍋犻褎绂嶆ィ鍐╁€垫繛鍫濈仢閺嬨倝鏌℃担鍓茬吋闁靛棔绀佽灃闁告侗鍘鹃崝锕€顪冮妶鍡楀潑闁稿鎸鹃埀顒冾潐閹稿摜鈧碍婢橀～蹇斻偊鐟併倓姹楅梺鍦劋閹碱偆妲愰悽鐢电＝濞达絾褰冩禍鐐箾鏉堝墽绉繛鍜冪秮閹矂宕卞☉娆戝幈闂侀€涘嵆濞佳囧几閻斿吋鐓熼柟鎯х摠缁€鍐磼缂佹娲存鐐差儏閳规垿宕卞顒傚幋濠德板€楁慨鐑藉磻閻愯　鈧箓宕堕埡鍌ゆ綗闂佸湱鍎ら〃鍛不閻斿吋鍊甸柨婵嗛婢т即鏌￠崱娆忊枅婵﹤顭峰畷鎯邦檨婵℃彃婀辩槐鎺旂磼濡偐鐣虹紓浣虹帛缁诲牆鐣烽幒鎴僵妞ゆ挾鍣ラ崬鐟扳攽閿涘嫬浜奸柛濠冨灴瀹曟洟鎼归锝呭伎婵＄偛顑呯€涒晠锝為弴銏＄厵闁绘垶锕╁▓鏃堝箚閻斿吋鈷戦梻鍫熶緱閻擃厼鈹戦垾铏枠濠碘€崇摠缁绘繈宕熼鐙呯闯濠电偠鎻徊鑲╁垝濞嗘挸浼犳繛宸簼閸嬨劍銇勯弽銊ｄ粶闁稿鎸搁悾鐑藉炊閵婏富鍟庨梻鍌欑閹诧繝銆冮崼銉ョ；闁圭増婢橀崙鐘诲箹濞ｎ剙濡介柣鎾寸懇濮婃椽顢橀妸褏鏆犻梺鍝勵儑閸犳劗鎹㈠☉銏犻唶闁绘梻顭堥埀顒佸姈閹便劍绻濋崒銈囧悑閻庤娲樼敮鎺楋綖濠靛鏁勯柦妯侯槷婢规洟姊鸿ぐ鎺擄紵闁绘帪绠撳畷鎴犫偓锝庡枟閻撴洟鏌￠崶銉ュ闁诲繒濞€閺屾盯濡搁妷銉㈠亾閹间焦绠掗梻浣虹帛閿氭俊顖氾躬瀹曟洝绠涢弴鐘筹紡闂佽鍨庨崟顐℃樊闂備浇顕栭崰妤呫€冮崨鏉戠叀濠㈣泛艌閺嬪孩绻涢崱妤佹崳閺夆晜姊圭换婵嬫偨闂堟稐绮堕梺缁橆殔閹虫劙宕氶幒鎴旀瀻闁规儳鐤囬幗鏇㈡⒑閸濆嫭宸濋柛鐘虫尵缁粯銈ｉ崘鈺冨幗闂侀€涘嵆濞佳勬櫠椤栫偞鐓熸繝鍨尵閻ｅ灚锟?(chin_control, mouth, chin)锟?   *
   * 婵犵數濮烽弫鍛婃叏閻戣棄鏋侀柟闂寸绾惧鏌ｉ幇顒佹儓闁搞劌鍊块弻娑㈩敃閿濆棛顦ョ紓浣哄У瑜板啴婀侀梺鎸庣箓閹冲酣藟韫囨梻绠鹃悗娑欘焽婢х敻鏌＄仦鐐缂佺粯绋栭ˇ鏌ユ煕閻曚礁浜伴柟顔缴戠换婵嬪炊閵娿垺瀚奸梻浣告啞閹告槒銇愰崘鈺冾洸闁绘劗鍎ら悡鏇㈡煟濡寧鐝€规洖鐭傞弻娑㈠煘閸喚浼堥悗娈垮枟閹歌櫕鎱ㄩ埀顒勬煥濞戞ê顏╂鐐茬墛娣囧﹪鎮欓鍕ㄥ亾閺嶎厼绀夌憸蹇擃嚗婵犲洤閿ゆ俊銈勭閸撳綊鎮楅崗澶婁壕闂佸憡娲﹂崜娑㈠储娴犲鈷戠紓浣股戦悡銉╂煙閼恒儳鐭岀紒顔碱煼閹瑩鎮滃Ο鐓庡箰闂佽绻掗崑鐘活敋瑜旈崺鈧い鎺嶇劍缁€瀣煙椤曗偓缁犳牠骞冨鍫熷癄濠㈣泛鑻埀顒傚仱濮婃椽妫冨☉杈╁彋婵犵鈧櫕绌块柕鍥ㄥ姌椤﹁锟?PIXI.Ticker 婵犵數濮烽弫鍛婃叏閻戝鈧倿顢欓悙顒夋綗闂佸搫娲㈤崹鍦婵犳碍鐓熼柡鍐ㄥ€哥敮鍓佺磼閻橀潧鈻堥柡宀€鍠栭獮鍡氼槾闁挎稑绉归弻锟犲幢椤撱垺顎嶉梺闈涙搐鐎氫即鐛幒鎴悑闁搞儜鍐剧€撮梻鍌欑閹诧繝鎮烽妷褎宕叉慨妞诲亾鐎殿喛顕ч鍏煎緞婵犱胶鐐婇梻浣告啞濞诧箓宕戦崒婊嗗С闁芥ê顦弨浠嬫煟閹邦垰鐨哄褎姊荤槐鎺楊敊閻ｅ本鍣伴悗娈垮枛椤嘲顕ｉ幘顔藉亜闁惧繗顕栭崯搴ㄦ⒒娴ｈ櫣甯涢柛鏃撶畵瀹曟粌顫濋懜闈涗户闂佹寧娲栭崐褰掑煕閹达附鈷戞い鎰╁€曟禒婊堟煠濞茶鐏￠柡鍛埣椤㈡盯鎮欑€电骞楅梻浣稿暱閹碱偊鏁冮妶澶嬪€堕柨鏃堟暜锟?   *   Spine 濠电姷鏁告慨鐑藉极閸涘﹥鍙忛柣鎴ｆ閺嬩線鏌熼梻瀵割槮缁炬儳顭烽弻锝夊箛椤掍焦鍎撶紓浣哄У婢瑰棛妲愰幒鏂哄亾閿濆骸浜介柛搴涘劦閺屾盯濡堕崱妯碱槹闂佸搫鏈惄顖炪€侀弴銏℃櫜闁糕剝鐟Σ浼存⒒娴ｄ警鐒炬い鎴濇嚇瀹曟劙宕稿Δ鈧粻鏍ㄤ繆閵堝懏鍣洪柡鍛叀楠炴牜鍒掗崗澶婁壕闁归鐒︽鍕節閻㈤潧浠﹂柛銊ョ埣楠炴劙宕妷褏鐓嬮悷婊呭鐢帡鎷戦悢鍏肩厪濠电偛鐏濋崝妤佷繆閹绘帞澧涘ǎ鍥э躬椤㈡稑鈻庨幒婵嗗Τ濠电偛顕慨鐑藉储瑜旈崺? state.apply(skeleton) 锟?updateWorldTransform() 锟?濠电姷鏁告慨鐑藉极閸涘﹥鍙忛柣鎴ｆ閺嬩線鏌熼梻瀵割槮缁炬儳顭烽弻锝夊箛椤掍焦鍎撶紓浣哄У婢瑰棛妲愰幒鏂哄亾閿濆骸浜介柛搴涘劦閺屾盯濡堕崱妯碱槹闂佸搫鏈惄顖炪€侀弴銏℃櫜闁糕剝鐟Σ浼存⒒?
   *   Ticker 婵犵數濮烽弫鍛婃叏閻戣棄鏋侀柟闂寸绾惧潡鏌熺€电孝缂佽翰鍊濋弻锕€螣娓氼垱锛嗛悷婊呭鐢帞澹曟總鍛婄厽闁归偊鍨伴惃娲煟濞戞牕鍔氶柍瑙勫灦楠炲﹪鏌涙繝鍐╃妤犵偛锕ラ幆鏃堝Ω閵夈儱娈ゅ┑鐐存尰閸╁啴宕戦幘缁樼厸閻忕偛澧介‖鑲╃磼閻樺磭娲寸€殿喗娼欒灃濞达絽鎽滆ぐ闈涒攽閻樺灚鏆╅柛瀣洴閹囧川椤栨艾鐏婂┑鐐叉閹告悂鎷戦悢鍏肩厸闁搞儮鏅涢弸鏃傜磼閻樿崵鐣洪柡宀嬬秮楠炲洭妫冨☉姗嗘浇闂備胶绮换鎰不閹炬剚娼栨繛宸簼閻掑鏌ｉ幇顖氳敿閻庢碍婢橀…鑳檨闁搞劌鐖煎濠氭晲婢跺﹦鍘告繝鐢靛Т閸婄粯绂掔粙璇炬棃鎮╅棃娑楃捕濠碘槅鍋呯换鍌炴偩瀹勯偊娼ㄩ柍褜鍓熼妴浣糕枎閹炬潙娈愰梺鍐叉惈閿曘儲鏅ュ┑鐘殿暜缁辨洟宕戦幋锕€纾归柡宥庡亝閺嗘粌鈹戦悩鎻掝仾妞ゆ劒绮欓弻宥夊Ψ閿斿墽鐛梺鎸庣箓椤︿粙寮澶嬬厽闁归偊鍠涜棢闂佸綊鏀卞钘夘潖濞差亜宸濆┑鐘插閻ｇ敻鏌ｆ惔銏犲毈闁哥姵顨婂鏌ュ醇閺囩偛宓嗛梺闈涢獜缁辨洟宕㈤悽鐢电＜闁绘劦鍓氱欢鑼偓瑙勬处閸撴氨绮嬪澶樻晬闁绘劕顕崢顏堟⒑閹肩偛鍔橀柛鏂挎湰閹便劌顓奸崶锝呬壕婵炲牆鐏濋弸娑欍亜椤撱垺鏁卞ǎ鍥э躬閹粓鎳為妷锔界彇闂備線鈧偛鑻晶顕€鏌嶇紒妯诲磳妤犵偛顑夐弫鍌滄喆閿濆棗顏归梻鍌欑閸氬绂嶆禒瀣？鐎广儱顦介弫鍌炴煕閳哄嫭纭炬繛璇у閳ь兛绲婚崑鎰板焵椤掑倹鏆╂い顓炵墣锟?apply 婵犵數濮烽弫鍛婃叏閻戣棄鏋侀柟闂寸绾惧鏌ｉ幇顒佹儓闁搞劌鍊块弻娑㈩敃閿濆棛顦ラ梺钘夊暟閸犳牠寮婚弴鐔虹闁绘劦鍓氶悵锕傛⒑鏉炴壆顦﹂悗姘嵆瀵鈽夊Ο閿嬵潔闂佸憡顨堥崑鐐烘倶瀹ュ應鏀介柣鎰级閸ｈ棄鈹戦悙鈺佷壕闂備礁鎼惌澶屽緤閸婄喓浜芥繝鐢靛仜濡瑩宕曢崘娴嬫灁妞ゆ挾濮风壕钘壝归敐鍛儓妞ゅ孩鎸剧槐鎾愁吋閸曨厾鐛㈤悗娈垮枛椤兘宕规ィ鍐ㄧ疀濞达絽鎲￠崐顖炴⒒婵犲骸浜滄繛璇х畵楠炴牠鍩℃导杈ㄦそ椤㈡﹢鎮滈崱妯虹槣闂備線娼ч悧鍡椢涘▎鎴滅剨闁绘鐗呯换鍡涙煟閹邦厼顥嬮柣顓熺懅閳ь剚顔栭崰娑㈩敋瑜旈崺銉﹀緞婵犲孩寤洪梺绯曞墲閿氶柛蹇擄攻娣囧﹪鎮欓鍕ㄥ亾閺嵮屽晠濠电姵鑹剧壕濠氭煙閸撗呭笡闁绘挻娲熼弻鏇㈠醇濠靛牆顣归梺鍛婂嚬閸嬪棛妲愰幒鎾寸秶闁靛鍎抽悷鎻掆攽閻愰潧甯剁紒缁樕戞穱濠傤潰瀹€濠冃梻浣风串缁叉儳顪冩禒瀣畺婵°倕鎳庨崹鍌涖亜閹板墎鎮奸柛鎴節閺岋絾鎯旈姀鐘叉瘓闂佹悶鍔嶉崕鐓幬涢悢鍏尖拺闁诡垎鍕洶闂佺顑勯悞锔剧矉瀹ュ拋鐓ラ柛顐ゅ枔閸樻捇鏌ｉ悩鍙夌闁逞屽墮閸熻法绮婚悷鎵虫斀闁绘劙顤傞崵瀣磼閻樿櫕灏柣锝囧厴楠炲鈹戦崘鈺傛澑闂佽鍑界紞鍡涘磻閸℃稑鍌ㄩ梺顒€绉甸埛鎴︽⒒閸喍绶辨俊顖氱墦閺屾盯鎮╅搹顐ゎ槹濡ょ姷鍋涢ˇ鐢稿箖濞嗘搩鏁嗛柛灞剧矤锟?apply 闂傚倸鍊搁崐鎼佸磹瀹勬噴褰掑炊瑜忛弳锕傛煟閵忋埄鐒剧紒鎰殜閺岀喖鏌囬敃鈧崝鎺撶箾瀹割喕绨婚柛鎰ㄥ亾婵＄偑鍊ら崜锕傚礈濮樿京鐭欓柟杈剧畱閻撯€愁熆鐠哄ソ锟犳偄閼姐倗鏉搁梺鍝勬川閸嬫稒淇婇搹鍦＝濞达綀娅ｇ敮娑氱磼鐠囪尙澧曢柣锝囧厴瀹曞ジ寮村璇蹭壕?   *
   * 闂傚倸鍊搁崐鎼佸磹瀹勬噴褰掑炊瑜忛弳锕傛煟閵忋埄鐒剧紒鎰殜閺岀喖骞嶉纰辨毉闂佺顑戠换婵嗩嚕閸洖閱囨慨姗嗗幗閻濇梻绱撴担鐣屽牚闁稿﹥绻堝璇测槈閵忕姷顔掑┑掳鍊愰崑鎾绘倵濮樼厧澧寸€规洏鍨奸妵鎰板箳閹绢垱瀚奸梻浣告啞閹告槒銇愰崘鈺冾洸婵犻潧娲ㄧ粻楣冩煕濞嗗浚妾ч柤鎷屾硶閳ь剚顔栭崰妤呮偂閿熺姰鈧礁螖娴ｇ懓顎撻梺鑽ゅ枑濠㈡ɑ瀵兼惔銏㈢瘈婵炲牆鐏濋弸鐔搞亜閵娿儲鍣归摶鐐翠繆閵堝嫮鍔嶆繛鍛У閵囧嫰寮崒姘闂佺顑嗛悧鐘诲蓟閺囩喎绶為柛鈩兩戦悵鏇㈡⒑?skeleton.updateWorldTransform()闂傚倸鍊搁崐鎼佸磹閹间礁纾归柣鎴ｅГ閸婂潡鏌ㄩ弮鍫熸殰闁稿鎸剧划顓炩槈濡娅ч梺娲诲幗閻熲晠寮婚悢鍛婄秶濡わ絽鍟宥夋⒑閹肩偛鈧牠宕濋弽顓炍﹂柛鏇ㄥ灠閸愨偓闂侀潧臎閸愨晜顔愰梻?apply 闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕濡ょ姷鍋涢ˇ鐢稿极閹剧粯鍋愰柤纰卞墻濡茬兘姊绘担鍛婃儓缂佸绶氬畷銏＄鐎ｎ亞锛涢梺璺ㄥ枔婵敻鎮¤箛鎿冪唵閻犺櫣鍎らˉ鐐寸箾閸涱厽鍤囬柡宀嬬秮椤㈡﹢鎮ゆ担鍦澒闂備礁鎼張顒勬儎椤栫偛鏄ラ柛鏇ㄥ灠缁€鍐┿亜韫囧海鍔嶆い顐㈢Ф缁辨捇宕掑▎鎺濆敼闂佺顑嗛幐鎼佲€﹂崸妤佸殝闂傚牊绋戦～宥夋⒑缂佹ɑ灏紒缁樺姍閸╃偤骞嬮敂钘夆偓鐑芥煙鐎涙绠撻柡鍡樼懄閵囧嫯绠涢敐鍕嚬闂侀€涚┒閸旀垿寮幇鏉垮窛闁哄鍨甸崣濠冪節濞堝灝鏋涢柨鏇樺妼閳诲秹鏁愰崶褍鐏婂┑鐐叉閸ㄨ泛鐣锋径鎰厪濠电倯鍐闁轰礁鍚嬬换婵嬫偨闂堟刀銉╂煛娴ｈ鍊愮€规洘鍨甸埥澶愬閳╁啯鐝栨俊鐐€曠换鎰偓姘卞厴瀹曠敻寮撮悢缈犵盎闂佽濯藉▔娑㈡儊濠婂牊鐓涘ù锝呮啞閸犳﹢鏌″畝瀣埌閾伙綁鏌熺粙鎸庢崳鐟滄妸鍐ｆ斀闁绘劘灏欐晶鏃堟煕濡や礁鈻曟鐐插暙閻ｏ繝鏌囬敂鎯у汲闂備礁鎲￠崝锔界閻愭潙顕遍柛銉㈡櫇绾捐棄銆掑顒佹悙闁哄绋掗妵鍕敇閻樻彃骞嬮悗娈垮櫘閸嬪﹪鐛崶顒夋晣闁绘劗鏁搁悰顔尖攽閻樺灚鏆╁┑顔芥尦楠炲鈽夐姀鐘插祮闂侀潧楠忕槐鏇㈠储閻㈠憡鈷戠紓浣股戠亸顓熺箾鐎电鍘存鐐搭殜閹晠鎮介悽纰夌床闂佽鍑界紞鍡樼閻愬瓨娅犻柨鏃堟暜锟?   *   婵犵數濮烽弫鍛婃叏閻戝鈧倿顢欓悙顒夋綗闂佸搫娲㈤崹鍦婵犳碍鐓欓弶鍫濆⒔閻ｈ京鐥幆褏绉洪柡宀嬬節瀹曞爼鍩℃担鍦偓鎯р攽閻愬弶鍣藉┑鐐╁亾濡ょ姷鍋為悧鏇″絹濡炪倖宸婚崑鎾斥攽闄囬崑鎰版儉椤忓牆绠氱憸婊堟偂婵傚憡鐓涢悘鐐额嚙婵″ジ鏌嶇憴鍕伌鐎规洟浜堕崺锟犲磼閸岋妇鐣垫慨濠勭帛閹峰懘寮妶澶屽椽闂備胶顭堥敃銉ф崲閸繍鍤曞┑鐘崇閸嬪嫰鏌涜箛姘汗闁告梻鍏樺娲箰鎼淬垻锛曢梺绋款儐閹稿銆冮妷鈺傚€烽弶鍫熷礃閳ь剙娼￠弻锛勪沪閸撗勫垱婵犵鍓濋幃鍌涗繆閻戣姤鏅查柛娑卞墮閸ㄦ繈姊婚崒娆愮グ妞ゆ洘鐗犲畷鏉库槈椤喚绋忔繝銏ｆ硾閻偐绮婚弮鍫熺厽闁哄倹瀵ч幉鍝ョ磼閳锯偓閸嬫捇姊绘担鍛婂暈婵炶绠撳畷锝堢疀閺囩噥娼熼梺姹囧灩閹诧繝鍩涢幒鎳ㄥ綊鏁愭径妯活棖婵炴垶鎹佺亸娆戞閹烘鍤戦柤鍝ユ暩閵嗗﹪姊洪崨濠傜瑲閻㈩垽绻濋妴浣糕槈濮楀棛鍙嗛梺鍛婁緱閸ㄦ娊宕㈤姘ｆ斀闁绘ê鐏氶弳鈺佲攽椤旂⒈鍤熼柍褜鍓氶惃婊堝炊瑜忛敍娑㈡⒑閻熸澘鈷旂紒顕呭灦瀵煡寮婚妷銉ь啇闁诲孩绋掗…鍥╃不濮椻偓閺岋綁鍩℃笟鈧妤併亜椤忓嫬鏆ｅ┑鈥崇埣瀹曟﹢濡搁姀鐘卞闂佸搫娲㈤崹鍦不閻樿崵鍙撻柛銉ｅ妽缁€鍐偓瑙勬礀瀵墎鎹㈠☉銏犵闁绘劕鐏氶崳褏绱撴担绋款暢闁稿鍊濆璇测槈閵忊晜鏅濋梺鎸庣箓濞层劑鎮鹃棃娑辨富闁靛牆楠告晶顕€鏌ｅΔ浣瑰碍妞ゎ偄绻愮叅妞ゅ繐瀚粣娑欑節閻㈤潧孝閻庢凹鍙冨畷瀹狀槻闁宠鍨块崺銉╁幢濡炲墽鍑归梻浣藉吹閸熷潡寮查悩鍏呯箚闁圭虎鍠栫粈鍐┿亜閺傛寧顫嶉柕濞炬櫆閻撳啴寮堕悙鏉戭棆閻庨潧銈搁弻宥夊传閸曨剙娅ら梺缁樻尭閸熸挳寮诲☉妯锋斀闁糕剝顨忛埀顒€绉归弻娑㈩敃閻樻彃濮庣紒鐐劤椤兘寮婚悢鍏煎€锋い鎺嶈兌娴煎洤鈹戦埄鍐ㄧ祷闁绘鎹囧濠氬即閿涘嫮鏉搁梺鍝勬川閸婎偊濡烽埡鍌滃弳濠电偞鍨堕悷褍煤鐎涙ü绻嗘い鎰╁灪閸ゅ洦銇勯姀鈩冪濠殿喒鍋撻梺鐐藉劜閸撴艾危鏉堛劎绡€闁汇垽娼ф禒婊勩亜閿旇寮€规洘鍔曢埞鎴犫偓锝庝簼濡差剟姊虹捄銊ユ灁濠殿喗娼欓蹇撯攽閸ャ儰绨婚梺鍝勫暙濞层倛顣块梻浣虹帛缁诲秹宕戞繝鍥ц摕闁挎繂妫欓崕鐔兼煃閵夈儱鏆遍弶鍫濇嚇濮婅櫣绮欏▎鎯у壉闂佸湱鎳撳ú顓烆嚕鐠囧樊鍚嬮柛顐亝椤庡洭姊绘担鍛婂暈闁圭顭烽幆鍕敍濮樿鲸娈惧┑顔筋焾濞夋稓绮婚幎鑺ョ厵闁割煈鍠栭弳鐐哄极閸儲鈷戦柛锔诲幖鐢爼鏌ｆ幊閸旀垿寮€ｎ偆绠鹃悗娑欘焽閻鏌涙惔銏犫枙婵犫偓娓氣偓濮婃椽骞愭惔锝囩暤闂佺懓鍟块柊锝咁嚕閹间礁围闁糕剝鐟ч鏇㈡⒑缁嬭法绠抽柛妯犲嫭鍙忛柛顐ｅ姴鎼淬劌鐐婄憸婵嬬叕椤掍降浜滈柕蹇婂墲缁€瀣煙椤旇娅呴棁澶愭倵閿濆簼绨峰瑙勬礋濮婃椽宕崟顒€鍋嶉梺鎼炲妼缂嶅﹪骞冮垾鏂ユ斀閻庯綆鍋嗛崢鎼佹⒑閸涘﹤濮傞柛鏂垮閺呭爼寮撮姀锛勫幈濠德板€撶粈渚€鍩㈤弴銏＄厸閻忕偟鏅晥闂佸湱顭堥敃銉ヮ嚗閸曨厸鍋撻敐鍛粵闁挎稐绶氬缁樻媴閽樺－鎾绘煕閵娧勬毈閽樻繈鏌ｉ姀銏╃劸闁藉啰鍠栭弻銊モ攽閸♀晜效闂佺顑呯€氫即寮诲☉妯锋婵鐗嗘慨娑橆渻閵堝繗绀嬮柛搴ㄤ憾閸╃偤骞嬮敃鈧悡锟犳煕閳╁啨浠︾紒銊ㄥ亹缁辨挻鎷呴崜鎻掑壉闂佹悶鍔岀紞濠傜暦閿濆宸濇い鏂垮⒔閻﹀牓姊哄Ч鍥х伈婵炰匠鍐懃濠电姷鏁搁崑娑㈡儑娴兼潙纾规繛鎴炵锟?   *
   * 闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕濡ょ姷鍋涢ˇ鐢稿极閹剧粯鍋愰柛鎰级閻ゅ嫬鈹戞幊閸娧呭緤娴犲鐤い鎰╁€愰崑鎾愁潩椤掑效闂侀潧娲ょ€氫即鐛幒妤€骞㈡俊鐐村劤椤ユ艾鈹戦敍鍕杭闁稿鍊栫粋宥咁煥閸繄鏌堥梺鍝勵槹閸ㄥ綊寮抽敃鍌涚厵闁绘垶锚閻忓秵淇婇幓鎺斿ⅵ闁哄备鈧剚鍚嬮煫鍥ㄦ惄濞差厼鈹戦悙宸Ц闁挎洦浜滈～蹇曠磼濡顎撻梺鍛婄☉閿曘倝寮抽崼婵愭富闁靛牆鍟俊濂告煟濡や焦灏柣锝囧厴楠炲鈹戦崘鈺婃綌婵犵數濮撮敃銈団偓娑掓櫅椤潡寮借閺€浠嬫煟濡櫣浠涢柡鍡忔櫊閺屾稓鈧綆鍓欐禒杈┾偓瑙勬礀缂嶅﹤鐣锋總绋垮嵆闁绘劖顔栭崬鍫曟⒒娴ｇ顥忛柛瀣噹鐓ら柡宥庡亜椤ユ氨鎲搁悧鍫濈瑲闁绘挻鐟╅弻娑㈠箻濡も偓閹冲海绮敓鐘斥拺缂備焦蓱鐏忣參鏌涙繝鍌涜础闁瑰箍鍨归埞鎴﹀炊閳哄啰妲囬梻浣侯焾閺堫剟宕欑憴鍕嚤閻忕偠袙閺€浠嬫煟閹邦垰鐨哄褎姊荤槐鎺楊敊閻ｅ本鍣伴悗娈垮枛椤嘲顕ｉ幘顔藉亜闁惧繗顕栭崯搴ㄦ⒒娴ｈ櫣甯涢柛鏃撶畵瀹曟粌顫濋懜闈涗户闂佹寧娲栭崐褰掑煕?
   *   - chin_control / chin: Y 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偞鐗犻、鏇氱秴闁搞儺鍓氶悞鑲┾偓骞垮劚閹虫劙鏁嶅☉銏♀拺缂備焦蓱閳锋帡鏌涙惔娑樷偓鏇㈡偩閻戣棄鐭楀璺虹灱閻﹀牓姊婚崒姘卞缂佸鎸婚弲鍫曞閵忋垻锛滈梺閫炲苯澧紒缁樼箞瀹曞爼濡歌楠炲牊绻濋悽闈涗沪闁搞劑娼ч悾鐑筋敆閸曨剙鈧爼鏌ㄥ┑鍡╂Ч锟?(婵犵數濮烽弫鍛婃叏閻戣棄鏋侀柟闂寸绾惧鏌ｉ幇顒佹儓闁搞劌鍊块弻娑㈩敃閿濆棛顦ョ紓浣哄С閸楁娊寮婚悢鍏尖拻閻庡灚鐡曠粣妤呮⒑鏉炴壆顦﹂悗姘嵆瀵鈽夊Ο閿嬵潔濠电偛妫欓崝妤冪矙閸ヮ剚鈷戞繛鑼额嚙楠炴銇勯妸銉уⅵ闁糕斁鍋撳銈嗗坊閸嬫挾绱掗悩鑼х€规洘娲熷畷锟犳倷瀹ュ棛鈽夐柍钘夘樀婵偓闁绘﹢娼ч獮鎺楁⒒娴ｅ憡鎯堥柛鐕佸亰閹勭節閸パ咃紮闂佹眹鍨归幉锟犳偂閵夛妇绡€闂傚牊绋掗ˉ銏°亜鎼淬埄娈旈棁澶嬬節婵犲倸顏柣顓烆儔锟?
   *   - mouth: scaleY 缂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮缁炬儳缍婇弻鐔兼⒒鐎靛壊妲紒鐐劤缂嶅﹪寮婚敐澶婎潊闁靛繆鏅濋崝鎼佹⒑濮瑰洤鈧宕戦幘鑸靛床婵犻潧娲ㄧ弧鈧梺绋挎湰缁矂銆傞崫鍕ㄦ斀?(闂傚倸鍊搁崐鎼佸磹閹间礁纾归柣鎴ｅГ閸婂潡鏌ㄩ弴鐐测偓鍝ョ不閺嶎厽鐓曟い鎰剁稻缁€鈧梺鎼炲妼閸婂潡寮诲☉妯锋斀闁糕剝顨忔导宀勬⒑缂佹ê绗╁┑顔哄€楅幑銏犫槈閵忕姴鑰垮┑鈽嗗灥椤曆呭枈瀹ュ洨纾介柛灞剧懆椤斿鏌￠崨顔剧煉濠碉紕鏁诲畷鐔碱敊閸撗勬緫闂備礁婀遍崑鎾诲礈濮橆厼顕辩€光偓閸曨兘鎷洪梺纭呭亹閸嬫盯鍩€椤掍胶澧悡銈夋煟閺冨倸甯堕柦鍐枔閳ь剙绠嶉崕閬嶆偋濠婂喚鐎堕柕濞炬櫆閳锋垿鏌涘☉姗堟敾閻忓繒鏁婚弻娑㈡偐閺屻儱寮伴梺?
   */
  setSpineTalking(idolId, isTalking, volumeCallback = null) {
    return this.lipSyncController.setTalking(idolId, isTalking, volumeCallback)
  }

  async _loadMouthSetting(idolId, spine) {
    return this.lipSyncController._loadMouthSetting(idolId, spine)
  }

  // Fade transitions

  /**
   * Fade a spine model in (alpha 0 锟?1) over ~300ms.
   * Fades the wrapper so the entire model blends as one layer.
   */
  setSpinePartsVisible(idolId, visible) {
    const entry = this.spineInstances[idolId]
    if (!entry?.spine) return
    entry.spine._partsVisible = visible !== false
    this._applyOptionalPartsSlots(entry.spine)
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
    const entry = Object.values(this.spineInstances).find(e => e.spine === spine)
    const target = entry?.wrapper || spine
    target.alpha = 0
    const durationMs = Math.max(0.01, Number(duration) || 0.3) * 1000
    const start = performance.now()
    const ticker = () => {
      if (target.destroyed) {
        this.app.ticker.remove(ticker)
        return
      }
      const t = Math.min((performance.now() - start) / durationMs, 1)
      target.alpha = t
      if (t >= 1) {
        this.app.ticker.remove(ticker)
      }
    }
    this.app.ticker.add(ticker)
  }

  animateSpineAlpha(idolId, targetAlpha, duration = 0.2, delay = 0) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const target = entry.wrapper || entry.spine
    if (!target || target.destroyed) return
    entry._alphaTween?.cancel?.()
    const startAlpha = Number.isFinite(target.alpha) ? target.alpha : 1
    const endAlpha = Math.max(0, Math.min(1, Number(targetAlpha)))
    const delayMs = Math.max(0, Number(delay) || 0) * 1000
    const durMs = Math.max(0.01, Number(duration) || 0.2) * 1000
    entry._alphaTween = runRafTween({
      durationMs: durMs,
      delayMs,
      startValue: startAlpha,
      endValue: endAlpha,
      ease: easeOutCubic,
      onUpdate: (alpha) => {
        if (!target.destroyed) target.alpha = alpha
      },
      shouldStop: () => target.destroyed,
      onComplete: () => {
        entry._alphaTween = null
      },
    })
  }

  /**
   * 婵犵數濮烽弫鍛婃叏閻戣棄鏋侀柛娑橈攻閸欏繐霉閸忓吋缍戦柛銊ュ€搁埞鎴﹀磼濠婂海鍔搁梺鍝勫閸庣敻寮婚垾宕囨殼妞ゆ柨鍚嬮崳鐑樼箾閸喐绀嬫慨濠囩細閵囨劙骞掗幙鍕惞缂傚倷璁查崑鎾炽€掑锝呬壕闂佽鍠氶崑銈呯暦瑜版帩鏁冮柣妯夸含閻╁酣姊绘担鐑樺殌闁圭⒈鍋嗙划鏃堝醇閺団偓閸ヮ剚鏅濋柛灞剧〒閸樺崬鈹戦悩缁樻锭婵☆偅鐟╅獮鍡涘醇閵夛富姊挎繝銏ｆ硾椤戝洨寮ч埀顒佺節閻㈤潧孝闁稿﹥鎮傞、鏃堝煛閸涱喚鍘遍梺鍝勫€介褔鍩€椤掍胶绠炵€殿喖顭峰鎾閻樿尪鈧灝鈹戦埥鍡楃仯闁稿簺鍊楅幏鐘绘倷閻戞ê鈧敻鎮峰▎蹇擃仾缂佸矁娉曠槐鎺楀矗婢跺﹤濮㈠銈嗘磸閸庨潧鐣烽悢纰辨晣婵犻潧娲ゆ刊浼存⒒娴ｈ棄袚闁挎碍銇勯敂钘夆枙鐎规洘绻傝灒閻炴稈鍓濋弬鈧梻浣虹帛閿氶柣蹇斿哺瀵娊鍩￠崨顔惧幈闁瑰吋鐣崹褰掓倶閳哄啠鍋撻崹顐ｇ凡闁挎洏鍊楅崣鍛渻閵堝懐绠伴悗姘煎櫍瀹曟繈鏁冮埀顒勨€旈崘顔嘉ч柛鈩冾殔濞兼垿姊虹粙娆惧剱闁圭懓娲璇测槈閵忊€充簻婵＄偛顑呯花濂告惞鎼淬劍锟?锟?婵犵數濮烽弫鍛婃叏閻戣棄鏋侀柟闂寸绾惧鏌ｅΟ娆惧殭缂佺姴鐏氶妵鍕疀閹炬惌妫ょ紓浣插亾濠电姴娲﹂悡鍐喐濠婂牆绀堟慨妯块哺瀹曞弶绻涢幋鐐垫噧缂佸墎鍋ら幃妤呮晲鎼粹€茬敖濡炪倧缂氶崡鎶藉箖?AlphaFilter 闂傚倸鍊搁崐宄懊归崶顒夋晪鐟滃繘鍩€椤掍胶鈻撻柡鍛█閵嗕礁鈻庨幘鍐插敤濡炪倖鎸鹃崑鐔兼偘閵夆晜鈷戦柛婵嗗閳诲鏌涘Ο鍨汗缂侇喛宕甸幉鎾礋閳衡偓缁ㄥ姊虹憴鍕凡濠⒀冮叄閹箖鏌嗗鍡欏幐?Spine 闂傚倸鍊搁崐鎼佸磹閹间礁纾归柣鎴ｅГ閸ゅ嫰鏌涢锝嗙５闁逞屽墾缁犳挸鐣锋總绋款潊闁炽儱鍟跨花銉╂⒒娴ｇ瓔娼愬鐟版閺呰泛螖閸涱厾锛涢柣搴秵娴滄牠寮ㄦ禒瀣厽婵☆垵顕х徊缁樸亜韫囷絼閭柡灞剧洴閹垽宕ㄦ繛澶歌檸闂備礁鎼張顒勬儎椤栫偛鏄ラ柛鏇ㄥ灠缁€鍐┿亜韫囧海鍔嶆い顐㈢Ч濮婄粯鎷呴懞銉闂佸摜鍠嶉崡鍐茬暦娴兼潙鍐€妞ゆ挾鍋犻幗鏇㈡⒑缂佹ɑ鈷掗柛妯犲懐涓嶉柡灞诲劜閻撴瑩姊洪銊х暠濠⒀勭叀閺屸剝鎷呴懞銉с€婄紓浣介哺閹稿骞忛崨鏉戠闁瑰搫绉撮ˉ姘舵⒒娴ｇ瓔鍤欓柛鎴犳櫕缁辩偤宕卞☉妯肩崶濠德板€曢幊蹇涘磻閸屾稓绠鹃柟瀵稿亹濡劎鎲搁悧鍫濈瑲闁哄懏鐓￠弻娑㈩敃椤愵澀绨肩紓鍌氱Т閻楀繒妲愰幘璇茬＜婵ɑ鐦烽敐澶嬬厱闁靛鍎茬拹鈩冧繆閸欏濮嶆鐐村浮楠炴鈧潧鎽滆倴濠碉紕鍋戦崐鏍礉閹达箑鍨傚┑鐘宠壘閸屻劍銇勯幇鍫曟闁抽攱鍨块弻锝夋偄閸涘﹦鍑″┑鈩冨絻椤兘寮婚悢鐓庣闁哄被鍎卞鏉款渻閵堝啫鐏拑杈╃磼閾忚娅曠紒顔界懇瀹曞綊顢欓崜褍鏄ユ繝纰夌磿閸嬫垿宕愰弽褜娼栧┑鐘崇閹偤骞栫划鐟扮厬婵炲樊浜堕弫宥夋煟閹邦喛藟闁归绮换娑欐綇閸撗冨煂闂佺顕滅换婵嗙暦椤栫偞鍊烽柣鎴烆焽閸橀亶姊洪崫鍕殜闁稿鎸荤换娑㈠矗婢跺瞼鐓傞梺鍛婂笚鐢€愁嚕椤曗偓瀹曠厧鈹戦崼顐Ｐゆ繝鐢靛仩閹活亞寰婇崸妞烩偓锕傚醇閵夛箑鈧泛鈹戦悩鍙夊闁抽攱鍨圭槐鎾存媴婵埈浜幃姗€鏁傛慨鎰盎濡炪倖鎸鹃崑鐐哄窗濮椻偓閺屾盯鍩為崹顔句紙閻庢鍣崳锝呯暦婵傚憡鍋勯柛婵嗗缁楁岸姊洪懡銈呮瀾缂侇喖绉堕崚鎺楀箻瀹曞洦娈惧┑鐘诧工閸熺娀寮告惔銊︾厵闁绘垶锚閻忊晠鏌涙繝鍐ㄦ诞婵﹤顭峰畷鎺戔枎閹烘垵甯梻浣侯焾椤戝啴宕濋幋婵堟殾闁哄洢鍨洪悞鑲┾偓骞垮劚閹虫劙寮婚崼銉︹拺闁告捁灏欓崢娑㈡煕閻斿弶娅婃鐐村浮楠炴ê鐣烽崶鈺冨祦闂傚倷绀佺紞濠囧磻婵犲洤鍌ㄥΔ锝呭暙锟?   * 闂傚倸鍊搁崐宄懊归崶褏鏆﹂柣銏㈩焾缁愭鏌熼柇锕€鏋涢柛銊︾箘閳ь剙绠嶉崕鍗炍涘Δ鍛瀭闁哄倹锛曡ぐ鎺撳亹鐎瑰壊鍠栭崜楣冩⒑鏉炴壆顦︽い鎴濇喘楠炲顫㈠畝鈧悿鈧┑鐐村灦閻熴儱鈻撻悢鍏尖拺闁告稑顭▓姗€鏌涚€ｎ剙鏋涚€殿喗濞婇弫鍐磼濞戞艾骞堥梻渚€娼ч¨鈧紒鑼跺Г娣囧﹥绺介崨濠勫幐闁诲函缍嗘禍婊堝焵椤掆偓閻忔繈锝炶箛鎾佹椽顢旈崟顓у敹闂佺澹堥幓顏嗗緤閸ф鍋╅柣銏犳啞閳锋垿鏌ｉ悢鍛婄凡闁哄棝浜跺铏规暜椤旀儳鍩屽銈嗘穿缂嶄線鐛弽銊﹀闁告縿鍎辨慨?X闂傚倸鍊搁崐鎼佸磹閹间礁纾归柣鎴ｅГ閸ゅ嫰鏌涢锝嗙５闁逞屽墾缁犳挸鐣锋總绋款潊闁炽儱鍟跨花銉╂⒒娴ｇ瓔娼愭繝銏★耿瀹曪綁骞樼拠鑼€炲銈嗗笂缁€浣圭閾忓湱纾藉ù锝呭閸庢挻绻涙径瀣鐎规洘绻堥弫鍐焵椤掑嫧鈧棃宕橀鍢壯囨煕閳╁喚娈旀繛鍏煎灴濮婅櫣绮欏▎鎯у壉闂佸湱顭堟晶钘壩ｉ幇鏉跨闁哄啫鍊婚敍婊冣攽椤旂瓔娈旀俊顐ｇ懇閹寧绗熼埀顒€锟?缂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾剧懓顪冪€ｎ亝鎹ｉ柣顓炴閵嗘帒顫濋敐鍛闂備胶鎳撶壕顓㈠窗閺嶎厹鈧礁鈽夐姀鈥斥偓鐑芥煛婢跺鐏嶉柛瀣崌閹虫粓鎮介悽鐢垫闂傚倸鍊搁悧濠勭矙閹烘挸绶為柛鏇ㄥ灡閻撴洟骞栨潏鍓у埌闁哄鍨圭槐鎺旂磼濡偐鐣虹紓浣虹帛缁诲牆鐣烽幒鎴叆闁告劗鍋撳鎴︽⒒閸屾瑧顦﹂柟纰卞亰楠炲繒鈧綆鍠栫粈鍫ユ煟閺冨倸甯堕柦鍐枑缁绘盯骞嬪▎蹇曞姶闂佽桨绀侀崯顖炲Φ閸曨垰绠抽柟瀛樼妇閸嬫捇寮拌箛濠傚緧闂傚倸鍊搁崐鐑芥嚄閸撲礁鍨濇い鏍仜缁犱即鏌熺紒銏犳灈闁汇倗鍋撶换娑㈠箣濞嗗繒浠剧紓浣哄У鐢€愁潖缂佹ɑ濯撮柣鐔煎亰閸ゅ绱撴担绛嬪殭闁稿﹥鐡曢悘瀣攽閻愬弶顥滅紒缁樺浮瀵娊鏁傞柨顖氫壕闁稿繐顦禍楣冩⒑閸涘﹥澶勯柛鎾寸洴瀹曘垽宕￠悙鈺傛杸闂佸疇妫勫Λ妤呮倶閿濆棎浜滄い鎾跺仧婢э箓鏌涢埞鎯т壕婵＄偑鍊栫敮濠囨嚄閼稿灚娅犻弶鍫氭櫇绾惧吋銇勯弮鍌楁嫛闁稿孩姊归〃銉╂倷閺夋垶璇為悗娈垮櫘閸ｏ綁宕洪埀顒併亜閹哄棗浜鹃梺浼欑秮閺€鍗烆嚗閸曨垰绠涙い鎾跺Т楠炴姊绘担鐑樺殌妞ゆ洦鍙冨畷鏇㈠箛閻楀牆鈧灝螖閿濆懎鏆為柣鎾存礃閹便劌螣閻撳骸浠樻繛瀛樼矌婢ф骞堥妸锔剧瘈闁告劏鏂傛禒銏ゆ倵鐟欏嫭纾搁柛鏂跨Ф閹广垹鈹戦崶銊ュ妳闂侀潧绻堥崹鍝勨枔娴犲鈷掗柛灞剧懅閸斿秹鎮楃粭娑樺幘濞差亝鏅滈柣锝呯焾濞茬顪冮妶鍛闁绘妫濆浼村Ψ閳哄倻鍘撻悷婊勭矒瀹曟粌顫濈捄浣曪箓鏌涢弴銊ョ仩缂佺姵濞婇弻娑㈠焺閸愶缚娌繝銏ｎ潐濞叉粎妲愰幘璇茬＜婵炲棙甯掗崢锛勭磽娓氬洤娅橀柛銊ㄦ硾閻ｇ柉銇愰幒鎿冩濠电偞鍨堕…鍥Χ椤愶附鈷掗柛灞剧懆閸忓本銇勯姀鐙呰含妤犵偞鎹囬、鏃堝幢濞嗗海鐟濋梻浣烘嚀椤曨厽鎱ㄦ搴濈剨闁汇垻顣介崑鎾荤嵁閸喖濮庡銈忕細閸楁娊骞冮垾鏂ユ闁靛骏绱曢崢鍗烆渻閵堝棗濮夊┑顔芥尦閹﹢顢旈崼鐔哄幐闂佺硶鈧磭绠叉繛鍛攻閹便劍绻濋崟顓炵閻庡灚婢樼€氼厾鎹㈠┑瀣闁瑰啿鍢插ú锕傛偂濞戞埃鍋撻崗澶婁壕闁诲函缍嗛崜娑溾叺闂傚倷鑳剁涵鍫曞疾椤忓棙宕叉繝闈涙閺嗭附鎱ㄥ璇蹭壕閻庤娲樼划蹇浰囬幓鎺嗘斀妞ゆ梻顑曢崑銏ゆ煛瀹€瀣М闁诡喓鍨藉畷顐﹀Ψ瑜忛崢鎴濃攽閻樻剚鍟忛柛銊﹀▕瀵煡顢曢敐鍥舵锤缂備礁顑呯花閬嶅几鎼淬劍鐓欓柟顖嗗拑绱為梺姹囧€曢幊姗€寮婚敐鍡樺劅闁靛繆鎳囨慨鍥煢閸愩劌鑸归柍瑙勫灴椤㈡稑鈽夊▎蹇撴敪闂備礁鎼惌澶岀礊娓氣偓閻涱喚鈧綆鍠楅崐濠氭煕閳╁啰鎳冨┑顔芥そ濮婄粯鎷呴崨濠冨創濠碘槅鍋呯粙鎺旀崲濞戙垹鐒垫い鎺嶇劍閸欏繐鈹戦悩鎻掍簽闁绘捁鍋愰埀顒冾潐濞叉鏁幒妤嬬稏婵犻潧顑愰弫鍕偣閹帒濡介柡鍛偢濮婂宕掑▎鎴犵崲濠电偠澹堝畷鐢垫閻愬搫鐐婇柍鍝勫暟椤︻垱绻涢幘鏉戠劰闁稿鎸搁埞鎴﹀焺閸愨晛鍞夐悗瑙勬礃鐢帡鍩ユ径濠庢僵闁稿繗鍋愰妶顐︽⒒娴ｇ瓔鍤欓柛鎴犳櫕缁辩偤宕卞☉妯硷紱闂佸憡渚楅崢鎼佸几瀹ュ鐓涚€广儱鍟俊璺ㄧ磼閳锯偓閸嬫捇姊绘笟鈧褎顨ヨ箛鏇炵筏闁告挆鍕幑婵°倧绲介崯顖炴偂閻旈晲绻嗛柕鍫濆€告禍楣冩⒑閸濄儱鏋戞繛鍏肩懇锟?   */
  _fadeOutWrapper(wrapper) {
    if (!wrapper || wrapper.destroyed) return

    // Keep the whole wrapper rendered as a single layer during fade-out.
    const alphaFilter = new PIXI.AlphaFilter(wrapper.alpha || 1.0)

    const STEP = 0.12  // 闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕濡ょ姷鍋涢ˇ鐢稿垂妤ｅ啫绠涘ù锝呮贡缁嬩胶绱撻崒姘偓鐑芥倿閿曚焦鎳岄梻浣告啞閻熴儳鎹㈠鈧濠氭偄閾忓湱锛滈梺闈涚箳婵敻鎮橀崼銏㈢＝濞达絽鎼暩闂佽桨绀侀…宄邦嚕鐠囧樊鍚嬮柛鈩兠～锟犳⒑閻熸澘妲婚柤娲诲灡閺呰埖銈ｉ崘鈺冨幍闂佺绻楅崑鎰板汲濮椻偓閺屾盯寮捄銊у姱闂佽鍠楅敃銏ょ嵁鎼淬劍鍤嶉柕澹啫绠為梻鍌欑缂嶅﹪宕戞繝鍥х婵炲棙鍨瑰Λ顖滄喐閺冨牆锟?(~8锟?
    const ticker = () => {
      // 闂傚倸鍊搁崐鎼佸磹瀹勬噴褰掑炊椤掑鏅悷婊冪Ч濠€渚€姊虹紒妯虹伇婵☆偄瀚划濠氭偐缂佹鍘甸梺璇″瀻閸愨晩鍟堥梻浣规偠閸庢椽宕滈敃鍌氭瀬鐎广儱顦伴悡鐔兼煙闁箑鐏犻柣銊︽そ閺岋綁骞橀弶鎴犱紝濠碘槅鍋勯幊姗€銆侀弴銏狀潊闁炽儲鍓氬Σ閬嶆⒒娴ｅ摜绉烘い銉︽崌楠炲﹪骞樼拠鑼弨婵犮垼鍩栭崝鏇綖閸涘瓨鐓熸慨妞诲亾婵炰匠鍕弿闁挎梹鍨濈换鍡涙煟閹板吀绨婚柍褜鍓氶悧鏇㈩敊韫囨梻绡€婵﹩鍓涢敍娑㈡⒑閻熸澘鈷旂紒顕呭灦钘熼柛鈩冾殢閻斿棝鏌ら幖浣规锭濠殿喖鐗撻弻娑欑節閸曨剚姣堥梺鍝勮閸斿矂鍩為幋锕€骞㈡俊顖滃劋椤忕姵淇婇悙顏勨偓褏寰婇悾灞筋棜妞ゆ挾濮甸～鏇㈡煙閻戞﹩娈旂紒鐘崇⊕閵囧嫰骞樺Δ鈧€氼噣寮抽敂鍓х＝闁稿本鐟ㄩ崗宀€绱掗鍛仸闁诡垰瀚伴、娑㈡倷閸欏鈧剟姊洪崷顓烆暭婵犮垺顭囨竟鏇㈠礂闂傚绠氶梺闈涚墕閸婂憡绂嶉悙顒傜閻庢稒顭囬惌鎺旂磼閻樺磭澧电€殿喛顕ч埥澶愬閻樼數鏉告俊鐐€栧濠氬磻閹惧墎纾奸柣娆愮懃濞诧箓鎮￠悢鍏肩叆闁哄啫娲よ濡炪們鍎遍悧鎾诲蓟閿涘嫪娌紒瀣仢閳峰鎮楅崹顐ｇ凡閻庢碍婢橀悾鐑藉础閻愬秶鍠栭幊锟犲Χ閸涱垰鍩屽┑鐘垫暩婵兘寮幖浣哥；婵炴垯鍨洪崕鎴澝归崗鍏肩稇缂佲偓婢舵劖鐓欓弶鍫濆⒔閻ｉ亶鏌￠崟鈺佸姦闁哄本娲濈粻娑氣偓锝庝簴閸嬫捇寮撮悩鐢电劶闂佺鐬奸崑鐐烘偂閻樺磭绠鹃柡澶嬪焾閸庢劙鏌℃径濠勭Ш闁哄矉绱曢埀顒婄秵閸嬪棙鏅堕鍛簻妞ゅ繐瀚弳锝呪攽閳ュ磭鍩ｇ€规洖宕灒闁绘垶蓱椤斿倿姊婚崒娆掑厡妞ゎ厼鐗忛埀顒佺▓閺呯姴鐣峰┑瀣嵆闁绘ɑ褰冮悿楣冩⒒閸屾瑧绐旀繛浣冲洦鍋嬮柛鈩冭泲閸ャ劌顕遍悗娑櫭禍?wrapper 闂傚倸鍊搁崐鎼佸磹瀹勬噴褰掑炊瑜忛弳锕傛煟閵忋埄鐒剧痪鎯ь煼閺岋綁骞囬浣瑰創缂備讲鍋撻柛鏇ㄥ幗閸犳劙鏌ｅΔ鈧悧鍡欑箔閹烘梻妫柟顖嗗瞼鍚嬮梺鍝勬湰閻╊垰顕ｉ幘顔嘉╅柕澹偓閸嬫捇顢楅崟顒傚幈闂侀潧顧€缁茶姤淇婄捄銊х＜闁抽敮鍋撻柛瀣尰缁绘繂鈻撻崹顔界亶闂佹寧娲嶉弲鐘茬暦閵徛板亝闁告劑鍔庨ˇ顕€姊鸿ぐ鎺擄紵闁绘帪绠撻崺娑㈠箣閿旇В鎷婚梺鍓插亞閸犲骸鐣烽悢鍏肩厱妞ゆ劗濮撮崝姘舵煟閵堝洤浜剧紒缁樼箖缁绘繈宕掑鍐炬毇闂備礁鎼鍕倿閿旂晫鈹嶅┑鐘叉祩閺佸秵绻濇繝鍌涘櫣缂佹绻濆娲川婵犲嫭鍣х紓浣虹帛閿曘垹顕ｆ繝姘╅柕澶堝灪閺傗偓闂備胶纭堕崜婵嬨€冭箛鏂款嚤闁逞屽墰缁辨捇宕掑▎鎴濆缂備礁顑嗛崹褰掑箲閵忋倕绠抽柡鍐ｅ亾妞ゎ偅娲熼弻鐔兼倻濡闉嶇紓鍌氱Т濞差參寮婚弴鐔虹鐟滃秹骞婇幇鏉挎辈妞ゆ挾濮风壕浠嬫煕鐏炲墽鎳呴悹鎰嵆閺屾盯鎮╅崘鍙夎癁閻庢鍠楄ぐ鍐煘閹寸姭鍋撻敐搴濈敖闁告棑绠戦—鍐Χ閸℃鐟ㄩ梺鎸庢穿婵″洨鍒掗弮鍫燁棃婵炴番鍨婚幊鎾烩€﹂妸鈺佺妞ゆ挾濮烽崢婊堟⒒娴ｇ瓔鍤冮柛鐘冲浮閸┾偓妞ゆ帊鐒﹂悘閬嶆煛閳ь剚绂掔€ｎ偆鍘卞銈嗗姉婵挳鎮橀鈧弻銊モ槈濞嗘垹鐣虹紓浣虹帛缁嬫帒顭囪箛娑樼鐟滃秹宕哄畝鍕拺缁绢厼鎳庤缂備緡鍠栫粔鐟邦嚕閼碱剚宕夐悶娑掑墲椤秴鈹戦悙鍙夘棞缂佸纾懞?Ticker
      if (wrapper.destroyed) {
        this.app.ticker.remove(ticker)
        return
      }

      alphaFilter.alpha -= STEP

      if (alphaFilter.alpha <= 0) {
        this.app.ticker.remove(ticker)
        const parent = wrapper.parent
        if (parent) parent.removeChild(wrapper)
        wrapper.destroy({ children: true, textures: true })
      }
    }
    this.app.ticker.add(ticker)
  }

  /**
   * 锟?idolId 闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕濡ょ姷鍋為悧鐘汇€侀弴銏犖ч柛鈩冦仦缁剝淇婇悙顏勨偓鏍礉瑜忕划濠氬箣閻樺樊妫滈梺绉嗗嫷娈曢柣鎾存礃缁绘盯宕卞Δ浣侯洶濠碘€冲级濡炰粙锟?wrapper 濠电姷鏁告慨鎾儉婢舵劕绾ч幖瀛樻尭娴滅偓淇婇妶鍕妽闁告瑥绻橀弻锝夊箣閿濆棭妫勭紒鐐劤椤兘寮婚敐鍛傜喎鈻庨幆褎顔勯梻浣告惈鐎氥劑宕曢悽绋胯摕闁炽儲鍓氶崥瀣煕閹扳晛濡兼い顒€顦埞鎴︽倷閸欏娅ф繝鐢靛亹閸嬫捇姊洪崫鍕効缂傚秳绶氬顐﹀箛閺夊灝绐涘銈嗘婵倗鈧碍濞婂?AlphaFilter 濠电姷鏁告慨鐑藉极閸涘﹥鍙忛柣鎴ｆ閺嬩線鏌熼梻瀵割槮缁炬儳娼￠弻鐔衡偓鐢殿焾瀛濈紓浣界堪閸婃牜鎹㈠☉姗嗗晠妞ゆ棁宕甸惄搴ㄦ⒑缂佹ê绗掗柣蹇斿哺婵＄敻宕熼姘鳖唺闂佺硶鍓濋妵鐐寸珶閺囥垺鈷掑ù锝呮啞閹叉悂鏌涢悩鏌ュ弰闁诡喗锚閳规垶绻濇惔銏＄槥濠电姷鏁告慨浼村垂婵傜鏄ラ柡宥庡幖缁€澶愭煛瀹ュ骸骞楅柛?   * 闂傚倸鍊搁崐鎼佸磹閹间礁纾归柣鎴ｅГ閸ゅ嫰鏌涢锝嗙５闁逞屽墾缁犳挸鐣锋總绋款潊闁炽儱鍟跨花銉╂⒒娴ｇ瓔娼愬鐟版閺呰泛螖閸涱厾锛涢柣搴秵閸犳鎮￠弴鐔虹闁瑰瓨绻傞懜褰掓煟韫囨洖鈻堥柡灞剧洴婵℃悂鏁傞崜褏鏉介梻浣告惈閻寰婇崐鐔轰航闂備胶顭堢换鎰板触鐎ｎ€帡宕熼鍌滎啎闂佺懓顕崑鐐典焊椤撶姷纾煎璺猴功缁夎櫣鈧鍠栭…閿嬩繆閹间礁唯闁靛繆妲呭鏃€绻濈喊妯活潑闁割煈鍨抽幏鍐晜閻ｅ矈娴勬俊銈忕到閸燁垶鍩涢幋鐘电＜閻庯綆浜滈惃锟犳煕閺冨倸鏋涢柡灞剧〒閳ь剨绲婚崝宀勫焵椤掍胶绠撴い鏇悼閹风姴霉鐎ｎ偒娼旈梻渚€娼х换鍡涘礈濠靛棌鏋嶆繝濠傜墛閳锋垿鏌涘☉姗堝伐濠殿喖鍊块弻娑㈠棘鐠恒劎鍔梺鐐藉劜閻楃姴鐣烽崡鐐╂婵炲棗鏈€氬ジ姊绘担铏瑰笡闁瑰摜顭堥湁闂佸灝顑囬々閿嬬箾閹存瑥鐏柣鎾存礋閺屾洘绻涢崹顔煎闁荤姵鍔х换婵嬪蓟濞戙垹绠抽柟鎹愭珪鐠囩偤鎮楀▓鍨珮闁革綇缍佸畷娲焵椤掍降浜滈柟鐑樺灥閳ь剛鎳撻悾鐑藉矗婢跺瞼鐦堥梻鍌氱墛缁嬫帡鏁嶅鍡欑閻忓繑鐗楀▍鍡涙煏閸パ冾伃妤犵偞顭囬幑鍕儎閹哄鐏紒杈ㄦ尭椤撳ジ宕担鍏夋瀰婵犳鍠栭敃銉ヮ渻娴犲绠犻柨鐔哄Т鍥撮梺鍛婄☉閹锋垹鎹㈠┑瀣摕闁挎繂顦粻鎶芥煟閹邦喗鏆╅柡鍡欏Т椤啴濡舵惔鈥崇闂佽绻戠换鍡涙倶閹烘鈷戦柛蹇氬亹閵堟挳鏌￠崨顔剧疄閽樻繃銇勯弽顐沪闁稿﹤鐏氶〃銉╂倷閼碱兛铏庨梺鍛婃⒐绾板秹濡甸崟顖涙櫆闁割煈鍠栫粊顕€鎮楀▓鍨灍闁绘搫绻濋妴浣肝旈崨顓狀槹濡炪倖宸婚崑鎾绘煃瑜滈崜娆撴偉婵傜钃熼柨婵嗩槸缁犳稒銇勯弽銊︾殤闁告﹩鍋勯—鍐Χ閸愩劌濮庡銈忓閺佽顕ｆ繝姘櫢闁绘ɑ褰冪粣娑橆渻閵堝棙鈷掗柛瀣崌瀹曟娊顢橀悩鐢碉紳婵炶揪缍€濞咃絿鏁☉銏＄厽闁冲搫锕ら悘锔锯偓娈垮櫘閸嬪﹪鐛崶顒€绾ч悹渚厜缁卞弶绻濆閿嬫緲閳ь剚鍔欏畷鎴﹀箻鐡掍胶鎳撻…銊╁醇閵忋垺姣囬梻浣告惈閺堫剟鎯勯鐐靛祦闁搞儺鍓﹂弫鍡涙煃瑜滈崜娑㈡儉椤忓浂妯勯梺鍝勭焿缂嶄線寮崒鐐村殟闁靛鍠楅ˉ鍫熺節濞堝灝鏋涢柨鏇樺劚椤啯绂掔€ｎ剙绁﹂梺褰掑亰閸樹粙宕曢悢鍏肩叆婵犻潧妫楅埀顒€缍婇敐鐐差吋婢跺鎷绘繛杈剧秬椤濡甸悢鍏肩厱婵☆垱浜介崑銏⑩偓瑙勬礃閸旀鍒掑▎鎾冲瀭妞ゆ柧鍕橀崑鎺楁⒒閸屾瑦绁扮€规洖鐏氶幈銊╁级閹炽劍妞芥俊鍫曞川閸屾粌鏋戠紒缁樼箞瀹曟帡濡堕崶褍楔婵犵數鍋涢顓㈠储瑜旈幃娲Ω閳哄倸浜楅棅顐㈡处缁嬫捇宕ｉ幘缁樼厱闁靛绲芥俊鐣岀磼閳ь剟鍩€椤掑嫭鐓涚€广儱绻掔弧鈧梺璇″枛閸㈡煡鈥﹂妸鈺佸耿婵°倕鍟慨娲⒒娴ｄ警鐒鹃梺甯到椤洩顦归柨婵堝仩缁犳盯骞樻担瑙勩仢妞ゃ垺鏌ㄩ濂稿幢濡崵褰囬梻鍌氬€风欢姘焽瑜旈幃褔宕卞☉妯肩枃闂婎偄娲︾粙鎺楀磹闂堟稈鏀介柣妯虹－椤ｆ煡鏌嶉柨瀣伌闁哄瞼鍠栭幊鏍煛娴ｉ鎹曞┑鐘茬棄閵堝懍姹楃紓浣介哺鐢偟妲愰幒鎴建闁割偓绲洪崑鎾诲锤濡や胶鍘藉┑鐐村灥瀹曨剙鈻嶅鍡╂闁绘劕妯婇崕鏃堟煛娴ｇ鏆ｉ柛鈹惧亾濡炪倖甯掔€氬摜绱為弽顓熺厱婵炴垶顭囬幗鐘绘煟閹惧啿鏆ｉ柡灞界У濞碱亪骞嶉鍛滈梻浣告惈椤戝啴宕愰弽銊р攳濠电姴鍋嗛崯鍛亜閺冨洤浜瑰ù鐘殿焾锟?idolId 闂傚倸鍊搁崐鎼佸磹閹间礁纾归柣鎴ｅГ閸婂潡鏌ㄩ弴鐐测偓褰掑磿閹寸姵鍠愰柣妤€鐗嗙粭鎺旂磼閳ь剚寰勭仦绋夸壕闁稿繐顦禍楣冩⒑闁偛鑻晶鎾煕閳规儳浜炬俊鐐€栫敮濠勭矆娓氣偓瀹曠敻顢楅崟顒傚幈濠电偛妫楃换鎰板汲濞嗘劑浜滈柡鍥朵簽閹偐绱掓潏銊ョ瑨閾伙綁鏌ゅù瀣珖婵℃彃娲缁樻媴鐟欏嫬浠╅梺绋垮缁挸鐣烽妸鈺婃晬婵炴垶姘ㄨⅵ闂傚倸鍊峰ù鍥х暦閻㈢绐楅柟閭﹀枛閸ㄦ繈鎮橀悙鐢垫憘婵炲皷鏅犻弻銊╁即閻愭祴鍋撻幖浣瑰仾妞ゆ柨顫曟禍婊堟煛瀹ュ骸浜滃ù鐙呯畵閺屽秹鏌ㄧ€ｎ亞浼岄梺鍝勭灱閸犳牠骞婇弽顓炵厸濞达綁顥撻幑鏇炩攽閻樻鏆柍褜鍓欓崯鍧楀箖閹达附鐓忛柛銉戝喚浼冨Δ鐘靛仜椤戝懘鍩為幋锕€鐐婄憸搴ㄦ偩婵犳碍鐓熼幖娣€ゅ鎰箾鐠囇呯暤鐎规洖缍婇獮搴ㄦ寠婢跺矈鍞归梻浣告啞濞诧箓宕归悧鍫濆姅闂佽崵鍠愮划宀€鎹㈠鈧幃浼搭敋閳ь剟鐛Ο灏栧亾闂堟稒鎲告い鏃€娲熼弻鈩冨緞婵犲嫬顣烘繝鈷€鍌滅煓妤犵偛鍟村畷妤冪箔鏉炴壆鐩庨梻浣瑰缁诲倻鈧凹鍣ｉ幆灞解枎閹存柨锟?   */
  _destroyWrapperNow(wrapper) {
    if (!wrapper || wrapper.destroyed) return
    const parent = wrapper.parent
    if (parent) parent.removeChild(wrapper)
    wrapper.destroy({ children: true, textures: true })
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
    delete this.spineInstances[idolId]

    if (immediate) this._destroyWrapperNow(wrapper || spine)
    else this._fadeOutWrapper(wrapper || spine)
  }

  /**
   * Set facial expression via Track 1 animation, with original game engine flag control.
   *
   * SideM spine data includes `face_xxx` animations (e.g. `face_happy`, `face_angry`).
   *
   * @param {string} idolId
   * @param {string} faceName - e.g. "happy", "angry", "face_happy"
   * @param {object|boolean} [faceFlags] - Flags from original data, or boolean shouldBlink for backward compat.
   *   { anim_flag: '锟?|'off', blush_flag: '闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣椤愯姤鎱ㄥ鍡楀⒒闁绘帞鏅幉鎼佸籍閸ヮ煈妫ㄥ┑锛勫亼閸婃牕煤瀹ュ纾婚柟鎯х摠閸欏繐鈹戦悩鍙夊櫤妞ゃ儱顦伴妵鍕箻閸愬弶鍊悗鍨緲鐎氼厾鎹㈠┑瀣闁割煈鍊ｅ┑鍡忔斀闁绘灏欏Λ鍕煛婢跺﹦姘ㄩ柛瀣崌瀵挳濮€閻樼數鏋冮梺纭呭亹鐞涖儵宕滃┑鍫㈡／?|'off', sweat_flag: '锟?|'off' }
   *
   * 闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕濡ょ姷鍋涢ˇ鐢稿极閹剧粯鍋愭い鎰枎娴滈箖鏌ㄩ弴鐐测偓鎼佹倷婵犲啨浜滈柟鍝勬娴滃墽绱撴担鐟板妞ゃ劌锕濠氭偄閻撳海鐣鹃悷婊冪箻楠炴鎮╁畷鍥╊啎闂佸憡渚楅崹鐗堢墡濠电儑绲藉ú銈夋晝椤忓懍绻嗛柛顐ｆ礀瀹告繃銇勯幘璺烘瀾妞ゆ柨顦靛铏规嫚閹绘帩鍔夐梺鍛婂灥缂嶅﹤鐣峰鍫熷亜闁绘挸姘﹂幗鏇炩攽閻愭潙鐏熼柛銊ユ贡缁鈽夐姀锛勫帗闁哄鍋炴竟鍡浰囬敂濮愪簻妞ゆ巻鍋撻柣妤€妫濋垾鏃堝礃椤斿槈褔鏌涢埄鍐剧劷闁告瑥妫濆娲箰鎼淬垻锛橀梺绋挎唉鐏忔瑧鍒掑顓熺秶闁靛ě鍛闂備焦鎮堕崕鎾春閺嶎厼鐤炬い鎺嗗亾闁宠鍨块弫宥夊礋椤愨€虫憢婵＄偑鍊栧▔锕傚礋椤撗勯敜闂備礁鎲￠幐鍡涘焵椤掑嫬纾婚柟鎹愬煐閸犲棝鏌涢弴銊ュ妞わ负鍎遍埞鎴︽倷閼碱剚鍕鹃梺鍛婃⒐閸ㄦ寧淇婄€涙鐟归柍褜鍓欓悾鐑藉Ω瑜夐崑鎾斥槈濞呰鲸宀搁獮?   *   anim_flag='锟?  锟?blink cover 150ms闂傚倸鍊搁崐鎼佸磹閹间礁纾归柣鎴ｅГ閸婂潡鏌ㄩ弮鍫熸殰闁稿鎸剧划顓炩槈濡娅ч梺娲诲幗閻熲晠寮婚悢鍛婄秶濡わ絽鍟宥夋⒑缁嬫鍎忔い鎴濐樀瀵鈽夐姀鐘靛姶闂佸憡鍔戦崝宥夊箚濞戞瑧绠鹃悗娑欘焽閻﹦绱撳鍜冭含鐎殿喖顭烽弫鎰緞婵犲嫮鏉告俊鐐€栧ú鏍箠韫囨挃鎺戠暆閸曨兘鎷虹紓浣割儐椤戞瑩宕曢幇鐗堢厵闁告稑锕ラ崐鎰版煕閳瑰灝鍔滅€垫澘瀚换娑㈡倷椤掑倵鍋撴繝姘棅妞ゆ劑鍨烘径鍕煙鐏忔牗娅呮い顓炴喘楠炴﹢宕滄担鐚寸闯闂備胶顭堥張顒勬偡閿斿墽鐭堥柡澶嬵儥濞撳鎮楀☉娅虫垿宕愰幇顔瑰亾鐟欏嫭绀€婵犫偓闁秴绠查柛鏇ㄥ墰閻熻銇勯弽銊ь暡妞ゆ柨鍊垮缁樻媴閸涘﹤鏆堝┑鐐额嚋缁犳挸鐣烽姀锛勯檮闁哄妫楅ˇ顖烇綖濠靛鍤嬮梻鍫熺▓閸嬫捇鎮介崨濠勫弳濠电娀娼уΛ娑㈠礄閸︻厾纾奸柕濞垮劚閹垿鏌曢崶褍顏€殿噮鍓熼獮鎰償閳╁啰浜峰┑鐘愁問閸犳牠鏁冮妸銉㈡瀺闁挎繂娲﹂～鏇㈡煙閻戞ê娈鹃柣鏂垮悑閹偤鏌涢敂璇插箺闁搞倕鍟村濠氬磼濞嗘帒鍘″銈庡幖閻楀棝锝炲┑瀣櫇闁稿本姘ㄩ敍娑㈡⒑閸︻厼顣兼繝銏☆焽缁寮婚妷锔惧帾闂婎偄娲ら鍛村焵椤掍焦绀堢紒顔肩墦瀹曟﹢顢欓悾灞藉妇濠电姷鏁告慨瀵告崲閹烘垹鏆嗘繛鎴欏灪閻撴洟鎮楅敐搴′簼鐎规洖鏈〃銉╂倷閺夋垹鐟ㄩ柧缁樼墵閺屽秷顧侀柛鎾跺枛楠炲啴鏁撻悩铏闂佺粯锚绾绢參宕㈤崡鐐╂斀闁绘劖娼欓悘銉р偓瑙勬处閸撶喖骞冨鈧弫鎰板幢閹邦亞鐩庨梻浣瑰濡線顢氳閳诲秴顓奸崱妯哄伎婵犵數濮撮崯顖炲Φ濠靛牃鍋撶憴鍕８闁告柨绉堕幑銏犫攽閸ャ劌鍔呴梺鎸庣箓閹冲孩顨欓梻鍌氬€搁崐椋庣矆娓氣偓楠炴顭ㄩ崟顒€寮块梺姹囧灮椤牏绮婚弶搴撴斀闁绘ê鐤囨竟姗€鏌ｉ妶澶岀暫闁诡喛顫夊顏堝箥椤旀嫎顓㈡⒑閸濆嫬鏆欓柣妤€妫楅蹇撯攽閸ャ儰绨婚梺瑙勫礃濞夋稒绂掕锟?0.1s 闂傚倸鍊搁崐宄懊归崶顒夋晪鐟滃秹婀侀梺缁樺灱濡嫮澹曟繝姘叆婵犻潧妫Σ鍝ョ棯閹呯Ш闁哄备鈧剚鍚嬮幖绮光偓宕囶啇缂備胶鍋撻崕鍐差焽閿熺姴钃熼柕鍫濇偪閸︻厸鍋撻敐搴′簼闁绘繃娲熼幃妤冩喆閸曨剛顦ラ悗娈垮枛婢у酣骞戦姀鐘斀闁搞儮鏅濋惁鍫ユ⒑缁嬫寧婀扮紒瀣灥閳诲秴鈹戠€ｎ偀鎷虹紓浣割儐椤戞瑩宕曢幇鐗堢厵闁荤喓澧楅崰妯活殽閻愭彃鏆炵紒鍌涘笧閳ь剨缍嗘禍婊堟倵椤撶儐娓婚柕鍫濇婵箓鏌涚€ｎ亜鈧潡鐛€ｎ偒妲归幖杈剧悼锟?
   *   anim_flag='off' 锟?闂傚倸鍊搁崐鎼佸磹閹间礁纾归柣鎴ｅГ閸婂潡鏌ㄩ弴妤€浜惧銈庝簻閸熸潙鐣风粙璇炬棃鍩€椤掑倻鐭嗛柛顐犲劜閻撱儵鏌￠崶鈺佷粶闁逞屽墮閹芥粎鍒掗崼銉ラ唶闁绘棁娅ｉ鏇㈡⒑缁洖澧查拑閬嶆倶韫囷絽寮柡灞剧洴婵℃悂濡烽妷銏犱壕闁秆勵殕閸嬪倹銇勯幇鍓佺暠闁绘劕锕弻鏇熺箾瑜夐崑鎾斥攽椤斿吋鍠樻慨濠冩そ瀹曨偊宕熼鈧娑㈡⒑閸涘﹥灏甸柛鐘崇墵閻涱噣宕橀…鎴炲缓闂侀€炲苯澧存鐐插暙閳诲酣骞嬮悙鑼紡闂佸搫顦遍崑鐔告櫠濡ゅ懏鍎撻煫鍥ㄧ⊕閳锋帒霉閿濆牊顥夐柛姘秺閺屾盯鎮╅崘鎻掝潕闂佺懓绠嶉崹钘夌暦婵傜唯闁靛鍔嶉幉鐗堢節閻㈤潧浠﹂柛銊ョ埣瀹曟椽宕橀鑲╋紱闂佺懓澧界划顖炲疾閺屻儱绠圭紒顔煎帨閸嬫捇鎳犻鈧崵顒勬⒒閸屾瑧鍔嶉柣顏勭秺瀹曟繂顓兼径濠傜€梺鍛婃尫閻掞箑鐣烽崣澶岀瘈闂傚牊渚楅崕蹇涙煟閹烘垹浠涢柕鍥у楠炴帡骞嬪┑鎰礉闂備浇妗ㄧ粈渚€宕愰崸妤€钃熸繛鎴欏焺閺佸啴鏌曢崼婵囧櫤闁诲骸顭峰娲川婵犲啫纰嶇紒鍓ц檸閸樻儳危閹版澘绠抽柡鍐ㄥ€婚敍婊堟⒑闂堟稓绠冲┑顔碱嚟閻氭儳顓奸崪浣瑰瘜闂侀潧鐗嗛崯顐﹀礉濠婂牊鐓欑紒瀣仢閳锋棃鏌涢幒鎾虫诞鐎规洖銈告俊鐑藉Ψ瑜滃Σ瑙勪繆閻愵亜鈧牠鎮уΔ鍐煓闁规崘顕ч崒銊╂煕濡ゅ啫浜归柡鈧禒瀣厽闁归偊鍓欑痪褎銇勯妷锔剧煂缂佽鲸甯楀鍕偓锝庡亜閸炲鎮楃憴鍕缂佽鍊块崺銏℃償閵娿儳顔掗柣搴ｆ暩椤牓鐛鈧缁樻媴缁嬫妫岄梺缁樻尭閻楁挸鐣烽幋锕€绀嬫い鏍ㄧ☉閳ь剙鐖奸幃妤€鈽夊▎娆庣返濠电偛鐗呯划娆撳蓟閿濆绠涙い鎺嗗亾缂佺嫏鍕╀簻闁靛绲介悘顕€鏌嶈閸撴繈锝炴径濞掗缚绠涘☉妯碱槷闂佺鎻拹鐔煎焵椤戣法顦﹂柍钘夘槸椤粓宕卞Ο鍝勫帪濠碉紕鍋戦崐鏍暜閹烘纾诲┑鐘插椤洟鏌ｉ姀銏℃毄缁惧彞绮欓弻娑氫沪閹规劕顥濋梺閫炲苯澧伴柛蹇旓耿楠炲啴鎮欓悜妯绘珖闂佺鏈銊┧囬鈧娲捶椤撶偛濡哄┑顔硷工椤兘骞嗗畝鍕耿婵＄偞娲栫紞濠囧极閹版澘妞藉ù锝呮贡缁嬫劕鈹戦悙鑼憼缂侇喖閰ｉ獮濠囧箻閻戔斁鍋撻敃鍌氶敜婵°倓绀佸▓婵嬫⒒閸屾氨澧涚紒瀣灴閿濈偛顓兼径瀣ф嫼?   *   blush_flag='闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣椤愯姤鎱ㄥ鍡楀⒒闁绘帞鏅幉鎼佸籍閸ヮ煈妫ㄥ┑锛勫亼閸婃牕煤瀹ュ纾婚柟鎯х摠閸欏繐鈹戦悩鍙夊櫤妞ゃ儱顦伴妵鍕箻閸愬弶鍊悗鍨緲鐎氼厾鎹㈠┑瀣闁割煈鍊ｅ┑鍡忔斀闁绘灏欏Λ鍕煛婢跺﹦姘ㄩ柛瀣崌瀵挳濮€閻樼數鏋冮梺纭呭亹鐞涖儵宕滃┑鍫㈡／? 锟?婵犵數濮烽弫鍛婃叏閻戣棄鏋侀柟闂寸绾惧潡鏌熺€电孝缂佽翰鍊濋弻锕€螣娓氼垱锛嗗┑鐐叉▕娴滄繈寮插鍫熺厽闁逛即娼ф晶顕€骞栭弶鎴含婵﹥妞藉畷銊︾節閸愵煈妲遍梻浣规偠閸斿秴顭垮Ο缁樻珡闂備礁鎼悮顐﹀磿閺屻儲鍋傞柛鎰典簼閸犳劖绻濇繝鍌滃缂佲偓閸儲鐓熼柡鍐ㄥ€哥敮鍫曟煢閸愵亜鏋涢柡灞炬礋瀹曠厧鈹戦幇顓夛妇绱撴担鍝勭彙闁搞儯鍔庨崢鐢告煟鎼达絾鏆╂い顓炵墛缁傛帡鏁冮崒娑氬幈闂佺粯锚閸熸寧鎱ㄥ澶嬬厸鐎光偓鐎ｎ剛蓱闂佽鍨卞Λ鍐╂叏閳ь剟鏌嶉崹娑欐珕闁诲繋绶氬缁樻媴閸涘﹥鍎撻梺纭呮珪閸旀牜鎹㈠☉銏犵劦妞ゆ帒鍊甸崑鎾斥枔閸喗鐝梺绋款儏鐎氫即銆佸Ο鑽ら檮缂佸娉曢崐鐐烘⒑閹稿孩顥嗘俊顐㈠閸掑﹥瀵肩€涙ǚ鎷绘繛杈剧悼椤牓骞冮幋婢濈懓顭ㄩ埀顒傚垝濞嗗繒鏆﹂柡鍥ュ灪閻掕偐鈧箍鍎遍幊鎰八囬銏♀拺闂傚牊鍗曢崼銉ョ柧婵犲﹤鐗嗛悡鏇㈡煙鏉堥箖妾柣鎾存礃缁绘盯骞嬮悜鍥у彆閻庤鎮堕崕宕囨閹烘嚦鏃€鎷呯粙鎸庢嚈闂備礁鎼惌澶岀礊娓氣偓楠炲啴濮€閵堝懐楠囬梺鐟扮摠缁诲倿锝為幘缈犵箚闁绘劦浜滈埀顒佺墵瀵濡歌瀹曞弶鎱ㄥ璇蹭壕閻庢鍠栭…宄扮暦閸楃倣鏃€绻濋崒娑樷偓顖炴⒒娴ｅ憡鍟炲〒姘殜瀹曞綊鎮￠獮顒婄秮楠炴﹢顢欑憴锝嗗濠电偠鎻徊鍧椻€﹂崼銉嬪绠涘☉娆戝幈闁诲函缍嗘禍婵嬪闯瑜版帗鍋傞柕鍫濇閸欏繑淇婇悙棰濆殭濞存粍鍎抽—鍐Χ閸愩劎浠鹃梺鎸庡哺閹繝濡堕崱鎰盎闂婎偄娲﹂幐濠氬闯娴犲锟?cheek_dye 闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗霉閿濆浜ら柤鏉挎健瀵爼宕煎顓熺彅闂佹悶鍔嶇换鍐Φ閸曨垰鍐€闁靛ě鍛帒闂備礁鎼Λ娆戝垝瀹ュ棛鈹嶅┑鐘叉搐鍥撮梺鍛婁緱閸欏孩绂掗崜褏锟?
   *   sweat_flag='锟?     锟?婵犵數濮烽弫鍛婃叏閻戣棄鏋侀柟闂寸绾惧潡鏌熺€电孝缂佽翰鍊濋弻锕€螣娓氼垱锛嗗┑鐐叉▕娴滄繈寮插鍫熺厽闁逛即娼ф晶顕€骞栭弶鎴含婵﹥妞藉畷銊︾節閸愵煈妲遍梻浣规偠閸斿秴顭垮Ο缁樻珡闂備礁鎼悮顐﹀磿閺屻儲鍋傞柛鎰典簼閸犳劖绻濇繝鍌滃缂佲偓閸喐鍙忔俊顖涘绾墽绱掗悩闈涗槐闁哄本娲樼换娑滎槻閻庢凹鍓熷鎼佸磼閻愮补鎷洪梺鍛婄☉閿曘儳绮堥埀顒勬⒑鐠囪尙绠茬€光偓閹间礁绠栭柟顖嗗懏娈濋梺閫涚祷濞呮洟寮埀顒勬⒒娴ｈ櫣甯涢柛銊╂涧鐓ら柕濞у懐鐓嬮梺姹囧灩閹诧繝鎮￠弴銏＄叆婵犻潧妫涚粻宕囩磼婢舵ê鏋ら柍褜鍓氶鏍闯椤曗偓瀹曟垿宕熼锝嗘櫍婵犻潧鍊婚…鍫ユ倷婵犲洦鐓ラ柡鍐ㄦ处椤ュ鈹戦娆忓祮婵﹦绮幏鍛矙閹稿骸鈧垱绻涚€涙鐭嗙紒顔界懃閻ｇ兘寮撮姀锛勫姸閻庡箍鍎遍幊鎰八囬銏♀拺闂傚牊鍗曢崼銉ョ柧婵犲﹤鐗嗛悡鏇㈡煙鏉堥箖妾柣鎾存礃缁绘盯骞嬮悜鍥у彆閻庤鎮堕崕宕囨閹烘嚦鏃€鎷呯粙鎸庢嚈闂備礁鎼惌澶岀礊娓氣偓楠炲啴濮€閵堝懐楠囬梺鐟扮摠缁诲倿锝為幘缈犵箚闁绘劦浜滈埀顒佺墵瀵濡歌瀹曞弶鎱ㄥ璇蹭壕閻庢鍠栭…宄扮暦閸楃倣鏃€绻濋崒娑樷偓顖炴⒒娴ｅ憡鍟炲〒姘殜瀹曞綊鎮￠獮顒婄秮楠炴﹢顢欑憴锝嗗濠电偠鎻徊鍧椻€﹂崼銉嬪绠涘☉娆戝幈闁诲函缍嗘禍婵嬪闯瑜版帗鍋傞柕鍫濇閸欏繑淇婇悙棰濆殭濞存粍鍎抽—鍐Χ閸愩劎浠鹃梺鎸庡哺閹繝濡堕崱鎰盎闂婎偄娲﹂幐濠氬闯娴犲锟?swet 闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗霉閿濆浜ら柤鏉挎健瀵爼宕煎顓熺彅闂佹悶鍔嶇换鍐Φ閸曨垰鍐€闁靛ě鍛帒闂備礁鎼Λ娆戝垝瀹ュ棛鈹嶅┑鐘叉搐鍥撮梺鍛婁緱閸欏孩绂掗崜褏锟?
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

      // 闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕閻庤娲﹂崹璺虹暦缁嬭鏃堝焵椤掑嫬纾奸柕濠忓缁♀偓婵犵數濮撮崐缁樻櫠閺囩姷妫柟顖嗗瞼鍚嬮梺鍝勭灱閸犳牕鐣峰鍡╂Ь闁汇埄鍨遍惄顖炲蓟閿濆绠婚柛鎰级濞堝姊洪崫鍕拱缂佸鐗滅划璇测槈閵忕姷顔撻梺鍛婂姀閺佲晠鏁傞悾宀€锟?婵犵數濮烽弫鍛婃叏閻戣棄鏋侀柟闂寸绾惧潡鏌熺€电孝缂佽翰鍊濋弻锕€螣娓氼垱锛嗗┑鐐叉▕娴滄繈寮插鍫熺厽闁逛即娼ф晶顕€骞栭弶鎴含婵﹨娅ｇ划娆戞崉閵娧傜礃闂備胶顭堥鍥磻閵堝懐鏆﹂柟杈剧畱鍥存繝銏ｆ硾椤戝洭宕㈤鍛瘈闁汇垽娼ф禒褔鏌涚€ｎ偅灏柍璇茬Ч瀹曞崬鈽夊▎鎴濆箞闂佽鍑界紞鍡樼閸洖纾块柡鍐ㄧ墛閻撴瑦銇勯弮鍌氬付婵℃彃顭烽弻宥囨嫚閸欏鏀紓浣哄У閻╊垶鐛▎鎾崇鐟滃繐螞椤栨埃锟?flag 婵犵數濮烽弫鍛婃叏閻戣棄鏋侀柟闂寸绾惧鏌ｉ幇顒佹儓缂佺姳鍗抽弻銈嗘叏閹邦兘鍋撻弴銏犲嚑闁割偀鎳囬崑鎾荤嵁閸喖濮庡┑鐐茬湴閸旀垿骞嗙仦瑙ｆ瀻闁规儳顕崢鐢告⒑缂佹ê鐏﹂柨鏇楁櫅閳绘捇寮撮姀锛勫幈闁硅偐琛ュΣ鍕叕椤掑嫭鐓涢悘鐐额嚙婵″ジ鏌嶉挊澶樻Ц閾伙絽銆掑鐓庣仧闁汇儺浜缁樻媴閸涘﹥鍎撳┑鈽嗗亝閻熝囧礆閹烘挻鍎熼柕濞垮劤閻ゅ懘姊鸿ぐ鎺擄紵缂佲偓娴ｈ櫣涓嶉柨婵嗩槹閻撱儵鏌￠崘銊﹀偍闁逞屽厴閸嬫捇姊虹粙娆惧剱闁圭懓娲ら悾鐑藉Ω閳轰胶顔愬銈嗘尵閸犳劕鈻嶉崶顒佲拻濞达絿鎳撻婊勪繆椤愶紕顦﹂摶鐐烘煕閺囥劌鐏犵紒锟?闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕閻庤娲﹂崹璺虹暦缁嬭鏃堝焵椤掑嫬纾奸柕濠忓缁♀偓婵犵數濮撮崐缁樻櫠閺囩姷妫柟顖嗗瞼鍚嬮梺鍝勭灱閸犳牕鐣峰鍡╂Ь闁汇埄鍨遍惄顖炲蓟閿濆绠婚柛鎰级濞堝姊洪崫鍕拱缂佸鐗滅划璇测槈閵忕姷顔撻梺鍛婂姀閺佲晠鏁傞悾宀€锟?
      if (faceFlags && typeof faceFlags === 'object') {
        spine._faceFlags = {
          anim_flag: faceFlags.anim_flag || '',
          blush_flag: faceFlags.blush_flag || '',
          sweat_flag: faceFlags.sweat_flag || '',
        }
      }

      if (allAnims.includes(animName)) {
        if (spine._currentFaceKey === faceKey) return
        const trackEntry = spine.state.setAnimation(1, animName, true)
        spine._currentFaceAnim = animName
        spine._currentFaceKey = faceKey
        if (trackEntry) {
          trackEntry.mixAttachmentThreshold = 0.0
          spine._blinkCoverEndTime = 0
          spine._savedEyeAtts = null

          // 闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕閻庤娲﹂崹璺虹暦缁嬭鏃堝焵椤掑嫬纾奸柕濠忓缁♀偓婵犵數濮撮崐缁樻櫠閺囩姷妫柟顖嗗瞼鍚嬮梺鍝勭灱閸犳牕鐣峰鍡╂Ь闁汇埄鍨遍惄顖炲蓟閿濆绠婚柛鎰级濞堝姊洪崫鍕拱缂佸鐗滅划璇测槈閵忕姷顔撻梺鍛婂姀閺佲晠鏁傞悾宀€锟?闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕濡ょ姷鍋為悧鐘汇€侀弴銏℃櫇闁逞屽墰缁鎮╅崗鍛畾濡炪倖鐗楃换鍌涚閸︻厾妫柟瑙勫姇琚氶梺閫涚┒閸斿矁鐏掗梺鍦焾濞寸兘濡撮幇顔剧＝濞达絾褰冩禍楣冩⒑缁嬫寧婀扮紒瀣浮瀹曪綀绠涢弬鍓х畾闂佺粯鍔欓·鍌炲吹濞嗗緷鐟邦煥閸垻鏆┑顔硷龚濞咃綁骞忛悩璇茬伋鐎规洖娲ｉ崫妤佺節閻㈤潧浠滄俊顖氾躬瀹曘垽鎳為妷褉鏀虫繝鐢靛Т閸嬪棗顭囬幍顔瑰亾閸忓浜炬繝鐢靛Т閸烆參顢旈崱娆戯紳闂佺鏈悷鈺侇瀶閻戣姤鐓曢柡鍌濇硶鑲栭梺鍛婂笚鐢繝鐛Ο鍏煎珰闁艰壈鍩栭幉浼存⒒娴ｈ櫣甯涙慨濠傤煼瀹曟洟濡堕崶锔惧墾闂佸湱鍎ら崺鍫ユ偄閸℃稒鍋ｉ柧蹇曟嚀閻ㄦ垹鈧鎮堕崕鐢稿蓟閿熺姴骞㈡俊顖氬悑閸ｄ即锟?闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕閻庤娲﹂崹璺虹暦缁嬭鏃堝焵椤掑嫬纾奸柕濠忓缁♀偓婵犵數濮撮崐缁樻櫠閺囩姷妫柟顖嗗瞼鍚嬮梺鍝勭灱閸犳牕鐣峰鍡╂Ь闁汇埄鍨遍惄顖炲蓟閿濆绠婚柛鎰级濞堝姊洪崫鍕拱缂佸鐗滅划璇测槈閵忕姷顔撻梺鍛婂姀閺佲晠鏁傞悾宀€锟?
          // 锟?锟?blink cover 150ms (闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕濡ょ姷鍋涢ˇ鐢稿极閹剧粯鍋愰柛鎰紦閻㈠姊绘担鐟邦嚋缂佽鍊胯棟妞ゆ牗绮岄ˉ姘舵煕瑜庨〃鍡涘煕閹寸偑浜滈柟鍝勬娴滃墽绱撴担鍓叉Ш闁轰浇顕ч悾鐑藉箣閿曗偓鍥撮梺绯曞墲閻熝囶敊閺囥垺鈷戠紒顖涙礀婢у弶銇勯妸銉︻棤缂侇喖顑囬埀顒婄秵閸犳鎮￠弴銏＄厪闁割偅绻冮ˉ鐐电磼閳ь剛鈧綆鍠楅悡娑㈡倶閻愬灚娅曢崯绋款渻閵囧崬鍊荤粣鏃堟煛鐏炲墽娲存鐐搭焽婢规洜鈧綆浜跺Λ鐔镐繆閻愵亜鈧牕煤韫囨稑纾块梻鍫熺〒閺嗭箓鏌ｉ弮鍌楁嫛闁轰礁娲弻锝夊箣濠靛浂妫″銈冨劵缁绘繂顫忛搹瑙勫珰闁圭粯甯掑В鎰磽閸屾氨孝婵☆偅鐟х划瀣吋閸涱亝鏂€闁诲函绲介悘姘跺疾閳哄懏鈷戦柟鑲╁仜閸旀挳鏌涢幘鏉戝摵闁糕晜鐩獮瀣偐閻㈢绱冲┑鐐舵彧缁蹭粙锝為弽顓ф晜闁糕剝鐟ч悾璺衡攽椤旂瓔鐒鹃柛鈺傜墵閹繝寮撮姀鐘殿啇濠电儑缍嗛崜娆撳焵椤掍焦绀冪紒鍌氱Х閵囨劙骞掗幘璺哄箥婵°倗濮烽崑娑㈡倶濠靛鍊堕柤纰卞厴閸嬫挾鎲撮崟顒傤槰闂佹寧娲忛崹鐑樼┍婵犲洤绠瑰ù锝堫潐濞呮粓姊虹粙鎸庢拱闁活収鍠楃粩鐔煎即閵忊檧鎷洪梺闈╁瘜閸樺ジ宕濈€ｎ偁浜滈柕濞垮劜閸ゅ洭鏌熼鍡欑瘈闁轰焦鎹囬幃鈺佺暦閸パ冪疄濠电姷鏁搁崑鐐哄垂闂堟稓鏆︽い鎺戝閸婂爼鏌ㄥ┑鍡橆棑濞存粍绮撻弻銊╁籍閸ヨ泛娈┑鐐叉噹缁夌敻骞堥妸锔剧瘈闁稿被鍊楅崥瀣倵鐟欏嫭绀冮悽顖涘浮閿濈偛鈹戠€ｅ灚鏅為柣鐘充航閸斿秹寮叉總鍛娾拻闁稿本鐟чˇ锕傛煙閻氭嚎鍊栭幊宀勬⒒娴ｄ警鐒鹃悗娑掓櫆缁绘稒绻濋崶褎妲梺缁樺姇閹碱偆绮堥崘鈹夸簻闁哄啫娲ゆ禍褰掓煥濞戞瑧鐭掓慨濠呮缁辨帒螣閸濆嫷娼欓梺璇茬箰缁绘垿鎮烽埡鍛偓浣糕枎閹邦喚鐦堥梺鎼炲劘閸斿骞忓ú顏呪拺闁告稑锕ゆ慨鍥┾偓娈垮枛閻栧ジ鐛崱娑橀唶闁靛濡囬崢閬嶆⒑缂佹ɑ纾荤紒鈧笟鈧幃姗€鏁愰崪浣哄數闁荤喐鐟ョ€氼厾绮堥崘顔藉€靛ù锝呭暙娴滃綊鏌嶈閸撴氨绮欓幒妞烩偓锕傚炊椤掆偓閸屻劑姊洪鈧粔鐢稿煕閹达附鐓曢柨鏃囶嚙楠炴牠鏌涢弬娆惧剶闁哄本鐩俊鎼佸Ω閵壯冨缚闁诲骸鐏氬妯尖偓姘緲閻ｇ兘鎮㈢喊杈ㄦ櫍濠电偞鍨剁湁濠㈣娲熼弻锝夋偄閸濄儲鍣ч柣搴㈠嚬閸樺墽鍒掗崼銉ョ妞ゆ梻鏅崢浠嬫⒑閻熸壆浠㈤悗姘煎枤瀵囧焵椤掆偓铻栭柣姗€娼ф禒婊勪繆椤愶絿绠炵€规洘妞介崺鈧い鎺嶉檷娴滄粓鏌熼悜妯虹仴妞ゅ浚浜弻锝夊箻鐎靛憡鍒涢梺鍝勬湰閻╊垱淇婇悜绛嬫晬婵犲﹤鍟悡鍌氣攽閻橆偅濯伴柛鏇ㄥ亞缁佺兘锟?
          // off 锟?闂傚倸鍊搁崐鎼佸磹閹间礁纾归柣鎴ｅГ閸婂潡鏌ㄩ弴妤€浜惧銈庝簻閸熸潙鐣风粙璇炬棃鍩€椤掑倻鐭嗛柛顐犲劜閻撱儵鏌￠崶鈺佷粶闁逞屽墮閹芥粎鍒掗崼銉ラ唶闁绘棁娅ｉ鏇㈡⒑缁洖澧查拑閬嶆倶韫囷絽寮柡灞剧洴婵℃悂濡烽妷銏犱壕闁秆勵殕閸嬪倹銇勯幇鍓佺暠闁绘劕锕弻鏇熺箾瑜夐崑鎾斥攽椤斿吋鍠樻慨濠冩そ瀹曨偊宕熼鈧娑㈡⒑閸涘﹥灏甸柛鐘崇墵閻涱噣宕橀…鎴炲缓闂侀€炲苯澧存鐐插暙閳诲酣骞嬮悙鑼紡闂佸搫顦遍崑鐔告櫠濡ゅ懏鍎撻煫鍥ㄧ⊕閳锋帒霉閿濆牊顥夐柛姘秺閺屾盯鎮╅崘鎻掝潕闂佺懓绠嶉崹钘夌暦婵傜唯闁靛鍔嶉幉鐗堢節閻㈤潧浠﹂柛銊ョ埣瀹曟椽宕橀鑲╋紱闂佺懓澧界划顖炲疾閺屻儱绠圭紒顔煎帨閸嬫捇鎳犻鈧崵顒勬⒒閸屾瑧鍔嶉柣顏勭秺瀹曟繂顓兼径濠傜€梺鍛婃尫閻掞箑鐣烽崣澶岀瘈闂傚牊渚楅崕蹇涙煟閹烘垹浠涢柕鍥у楠炴帡骞嬪┑鎰礉闂備浇妗ㄧ粈渚€宕愰崸妤€钃熸繛鎴欏焺閺佸啴鏌曢崼婵囧櫤闁诲骸顭峰?(闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕濡ょ姷鍋涢ˇ鐢稿极閹剧粯鍋愰柛鎰紦閻㈠姊绘担鐟邦嚋缂佽鍊胯棟妞ゆ牗绮岄ˉ姘舵煕椤垵鏅圭憸鐗堝笚閸嬪倿骞栨潏鍓хɑ闁规彃銈稿娲箹閻愭祴鍋撻弴銏″亱闁规崘顕ч拑鐔兼煟閺傛寧鍟炵紓宥呮喘閺屾盯骞樺Δ鈧幊蹇撯枔閸濄儳纾介柛灞剧懆閸忓苯鈹戦鈧褔鎮惧┑瀣濞达絾鐡曢幗鏇炩攽閻愭潙鐏﹂懣銈嗕繆閹绘帞澧﹂柡灞剧☉铻栭柛鎰╁妺閹撮攱绻涚€电袥闁哄懐濞€楠炲啫螖閸愨晛鏋傞梺鍛婃处閸撴盯藝閵娿儮鏀介柣鎰絻缁狙呯磼椤斿ジ顎楅崡閬嶆煙閻楀牊绶茬紒鐘烘珪娣囧﹪濡堕崒姘缂傚倷鑳舵慨鐢电矙閹烘桅闁告洦鍠氶悿鈧梺瑙勫礃閹活亞妲愰悙娴嬫斀闁炽儴娅曢埢鏇㈡煕閿濆繒绉鐐插暙閻ｏ繝鏌囬敂鎯у汲闂備礁鎲″ú锕傚礈濞戙垹绀勯柍銉﹀墯濞撳鏌曢崼婵堢妞も晩鍓熼弻鈩冩媴缁涘娈銈嗘穿缂嶄線銆侀弴銏狀潊闁宠桨鐒﹂崐顖炴⒒娴ｈ鍋犻柛搴☆煼濮婁粙宕熼姘鳖槹闂佸憡鍔﹂崰妤呭煕閹达附鐓曢煫鍥ㄨ壘娴滃綊鏌曢崼鐔稿唉闁哄矉绻濆畷銊╊敊閸撗呮澖婵°倗濮烽崑娑⑺囬幎钘壩﹂柟鐗堟緲缁犳娊鏌熺紒銏犵仭閻庢艾銈稿缁樻媴閾忕懓绗￠梺鐟版憸椤牓婀侀梺缁樺灱婵倝寮查鍌楀亾楠炲灝鍔氭い锔垮嵆閹€斥槈閵忥紕鍘卞┑鐘才堥崑鎾剁磼閳ь剚鎷呴崷顓ф锤婵炲鍘ч悺銊╂偂濞嗘劑浜滈柡鍐ㄦ搐琚氶梺闈涙处缁诲啴銆冮妷鈺傚€风€瑰壊鍠栭崜鍫曟⒑鏉炴壆顦﹂柛濠傤煼楠炲骞橀鑺ユ珳闂佺硶鍓濋〃蹇斿濠婂嫮绡€缁炬澘顦辩壕鍧楁煕鐎ｎ偄鐏寸€规洘鍔欏浠嬵敇閻愭鍞堕梻浣虹帛閸旓箓宕滃璺虹煑闊洦绋掗悡鐔搞亜椤愵偄骞樼紒浣稿槻锟?
          // 锟?闂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕濡ょ姷鍋為悧鐘汇€侀弴銏℃櫆闁芥ê顦純鏇熺節閻㈤潧孝闁挎洏鍊楅埀顒佸嚬閸ｏ綁濡撮崨鏉戣摕闁靛濡囬崢浠嬫⒑瑜版帒浜伴柛鐘崇墵瀹曟繄鈧綆鍠楅悡?flag 锟?婵犵數濮烽弫鍛婃叏閻戣棄鏋侀柟闂寸绾惧潡鏌熺€电孝缂佽翰鍊濋弻锕€螣娓氼垱锛嗗┑鐐叉▕娴滄繈寮插鍫熺厽闁逛即娼ф晶顕€骞栭弶鎴含婵﹨娅ｇ划娆戞崉閵娧傜礃闂備胶顭堥鍥磻閵堝懐鏆﹂柟杈剧畱閻撴盯鏌涢幇銊︽珔闁哄鍨块弻鐔煎礂閼测晜娈梺鍛婃煥椤︾敻宕洪埀顒併亜閹哄秶鍔嶆い銉ョ墦閺屾盯鍩為幆褌澹曞┑锛勫亼閸婃牜鏁繝鍌ゆ富闁圭儤姊瑰畷鏌ユ煕閳╁叇婊勭濠婂牊鐓涚€广儱鍟俊铏圭磼閸洑鎲鹃柡灞剧⊕閹柨鈽夊Ο鍝勑曢梻浣告惈閺堫剛绮欓幋锔肩稏婵犻潧顑愰弫鍡椕归敐鍛暈闁诲繐閰ｅ缁樻媴閸涘﹥鍎撻柣鐐村嚬閸嬪﹤鐣峰┑鍡欐殕闁告洦鍋嗛崣鈧┑鐘灱濞夋稖鐧岄梺缁樻⒒閸樠囧垂閸屾稏浜滈柡鍥╁仦閸ｅ摜绱掓潏銊︹拹缂佺粯绻堥幃浠嬫濞戞鎹曟俊鐐€栧ú锕傚储娴犲绠為柕濞炬櫆閸嬨劑鏌涘☉姗堝伐闁告搩鍠栭—鍐Χ閸℃瑥鈷堥梺绋款儐缁嬫挾鍒掔拠宸僵闁煎摜鏁搁崢閬嶆⒑闂堟侗妯堥柛鐘崇墬閺呭爼顢氶埀顒勭嵁閸℃稒鍋勯柛蹇曞帶娴狀厼鈹戦悩璇у伐闁哥噥鍨堕獮鎴︽晲婢跺鍘鹃梺鍛婄箓鐎氼剟鎳滅憴鍕╀簻妞ゆ挻绮屾慨鍌溾偓瑙勬礀閵堟悂骞冮姀銈呬紶闁告洦鍋嗛濂告⒒閸屾瑦绁扮€规洜鏁诲畷鎴︽倷閻㈢數鐓撻梺鍓插亖閸庤京绮堥崼鐔虹瘈闂傚牊绋掗ˉ鎴︽煛鐎ｎ亞效闁哄本鐩崺鍕礃閿旇法鎹曢梻浣姐€€锟?
          if (faceFlags && typeof faceFlags === 'object' && faceFlags.anim_flag === 'off') {
            // off means the switch is instant, without blink masking.
            spine._blinkCoverEndTime = 0
          } else if (faceFlags && typeof faceFlags === 'object' && faceFlags.anim_flag === '锟?') {
            // anim_flag === '锟?: 闂傚倸鍊搁崐鎼佸磹閹间礁纾归柣鎴ｅГ閸婂潡鏌ㄩ弴妤€浜惧銈庝簻閸熸挳鐛幇顓熷劅闁挎繂瀛╅柨銈嗙節瀵伴攱婢橀埀顒佹礋楠炲﹥鎯旈敐鍥╃劶婵犮垼鍩栭崝鏇犵不閸︻厾纾兼い鏃€顑欏鎰亜鎼粹剝顥㈤柡宀嬬節閸┾偓妞ゆ帒瀚弲婵嬫煕鐏炲墽銆掗柛姗€浜堕幃妤呭礂婢跺﹣澹曢梻渚€鈧偛鑻晶瀵糕偓瑙勬礃閸ㄧ敻鍩ユ径濠庢僵闁告瑦顭囬悷婵嬫⒒娴ｇ瓔娼愰柛搴″悑閹便劑濡舵径瀣簵闂佸憡鍔﹂崰妤呮偂閺囩喓绡€闂傚牊绋掗ˉ婊勩亜韫囧﹥娅婇柡灞界Х椤т線鏌涢幘鏉戝摵闁诡喗妞藉鎾綖椤戣棄锟?150ms
            spine._blinkCoverEndTime = 0
            spine._savedEyeAtts = null
            trackEntry.mixDuration = 0.03
          } else {
            // 锟?flags 闂傚倸鍊搁崐鎼佸磹閹间礁纾归柣鎴ｅГ閸ゅ嫰鏌涢锝嗙缂佺姷濞€閺岀喖宕滆鐢盯鏌涚€ｃ劌鈧繈寮婚弴鐔虹闁绘劦鍓氶悵鏇㈡⒑缁嬫鍎忔い鎴濇缁岃鲸绻濋崶顬囨煕鐏炲墽鐓瑙勬礋濮婄粯鎷呴悷閭﹀殝濠电偞褰冪换妯虹暦鐟欏嫮顩烽悗锝冨妷閸嬫挻鎷呴崜鍙夊缓闂侀€炲苯澧柟渚垮姂閸┾偓妞ゆ帒瀚悡鍐煏婢跺牆鍔氶柡鍡楀船椤法鎲撮崟顐ｈ癁濠殿喖锕︾划顖滅箔閻旂厧鐒垫い鎺嗗亾妞ゎ厼娲╅ˇ褰掓寠濠靛洢浜滈柟鎯у船閻忊晝鐥悙顒€顕滈柕鍥у瀵潙螖閳ь剚绂嶆ィ鍐╋拷? 闂傚倸鍊搁崐鎼佸磹瀹勬噴褰掑炊椤掑鏅悷婊冪Ч濠€渚€姊虹紒妯虹伇婵☆偄瀚划濠氭偐缂佹鍘甸梺璇″瀻閸愨晩鍟堥梻浣规偠閸庢椽宕滈敃鍌氭瀬鐎广儱顦伴悡鐔兼煙闁箑鐏犻柣銊︽そ閺岋綁骞橀弶鎴犱紝濠碘槅鍋勯幊姗€銆侀弴銏狀潊闁炽儲鍓氬Σ杈ㄧ節绾版ɑ顫婇柛瀣閹广垽骞囬弶璇俱儵鏌熼悜姗嗘畷闁搞倕顑夐弻娑滅疀閹惧瓨鍠愮紓浣哄У閼归箖鈥旈崘顔嘉ч柛鈩冪懃椤勭箾閹惧顣叉い銊ワ工閻ｇ兘寮撮姀鐘栥劑鏌嶉崫鍕偓濠氬储閸楃偐鏀芥い鏃€鏋绘笟娑㈡煕閹炬潙鍝虹€规洘婢橀～婊堝焵椤掑嫬钃熼柨娑樺濞岊亪鎮归崶銊ョ祷妞ゎ剙鐗撳铏光偓鍦У椤ュ銇勯敂璇茬仴闁诲繑甯″娲礈閼碱剙甯ラ梺闈╃秵閸犳鈧潧銈稿畷姗€濡搁姀鈩冩澑闂備胶绮崝鏇炍熸繝鍥у惞闁绘柨鐨濋弨鑺ャ亜閺冨倸浜鹃柡鍡╁墴閺岀喖顢涘顒変純濡炪們鍨洪惄顖炲箖濞嗘挻鍤戞い鎺戝€瑰В搴ㄦ⒒閸屾瑧鍔嶉柟顔肩埣瀹曟洖煤椤忓嫮顦┑鐐叉閸旀洟宕濋弮鍫熲拺闁煎鍊曢弸鎴犵磼椤旇壈瀚伴棁澶愭煟閹达絽袚闁搞倕绉归弻娑樜旈崘銊ュ闂佺粯鎸堕崕鐢稿蓟濞戙埄鏁冮柕鍫濇噺閻忎線姊洪崨濠庣劷闁轰礁顭峰濠氭晲婢跺鈧兘鎮楅悽鐢点€婇柡瀣濮婃椽宕ㄦ繝鍐ㄩ瀺缂備浇顕ч崐鍧楀春閵忕媭鍚嬪璺猴工閼板灝鈹戦敍鍕户缂侇噮鍨跺顒勫焵?
            spine._blinkCoverEndTime = 0
            spine._savedEyeAtts = null
            trackEntry.mixDuration = 0.03
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
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const target = entry.wrapper || entry.spine
    target.alpha = alpha
  }

  bringSpineToTop(idolId) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry
    const parent = spine.parent
    if (parent) parent.setChildIndex(spine, parent.children.length - 1)
  }

  /**
   * Play an animation on Track 0 (body) with automatic loop chaining.
   *
   * Convention (from SideM spine data):
   *   - Animations with a `_loop` suffix are looping (e.g. `wait_loop`, `angry_loop`).
   *   - Most emotional actions have a paired loop: `angry` 锟?`angry_loop`.
   *   - Single-shot animations (e.g. `neck_yes`, `neck_no`) have no `_loop` variant
   *     and should fall back to `wait_loop`.
   */
  playSpineAnim(idolId, animName, skipChain = false, noBack = false, motionSetting = null) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry
    try {
      const allAnims = spine.state.data.skeletonData.animations.map(a => a.name)
      if (spine._currentBodyAnim === animName) return

      if (animName.endsWith('_loop')) {
        // Already a loop animation 锟?play directly
        spine.state.setAnimation(0, animName, true)
      } else if (skipChain || noBack) {
        // Single-shot, no auto-chain 锟?used when step has timeline
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
   * Instant body animation switch 锟?no crossfade morph (for timeline events).
   * The animation starts from frame 0 at native speed, avoiding the "sliding"
   * caused by linear interpolation between two different poses.
   */
  switchSpineAnim(idolId, animName) {
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
      spine.stateData.defaultMix = 0.3  // 300ms 锟?smooth timeline anim transitions
      spine.state.setAnimation(0, animName, isLoop)
      spine._currentBodyAnim = animName
      spine.stateData.defaultMix = savedMix
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to switch anim "${animName}" on "${idolId}":`, err.message)
    }
  }

  playSpineNeckAnim(idolId, animName) {
    // DISABLED 锟?neck animation on Track 3 causes pose freezing; needs full
    // transition model rework to match official snap-cut style (see ADV_STATE_MACHINE_NOTES.md)
    return
    /* original code:
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
    // DISABLED 锟?see playSpineNeckAnim
    /* original code:
    const entry = this.spineInstances[idolId]
    if (!entry) return
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
    this._fadeOutAndDestroy(idolId, immediate)
  }

  clearAllSpines() {
    this.lipSyncController.clearPending()
    this._pendingTalking = this.lipSyncController.pendingTalking
    // Reset camera zoom/pan
    this.resetCameraZoom()
    // Collect wrappers first so we can clear the map before fade-outs begin.
    // This avoids stale ticker callbacks destroying a newer model with the same idolId.
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
        wrappers.push(entry.wrapper || entry.spine)
      }
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
    this.backgroundManager?.destroy()
    this.backgroundManager = null
    if (this.app) {
      this.app.destroy(true)
      this.app = null
    }
  }
}
