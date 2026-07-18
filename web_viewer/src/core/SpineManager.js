import * as PIXI from 'pixi.js'
import { MixBlend } from '@pixi-spine/base'
import { easeOutCubic, runRafTween } from './rafTween.js'

export class SpineManager {
  constructor(manager) {
    this.manager = manager
  }

  setSpinePosition(idolId, positionIdx) {
    const entry = this.manager.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry
    const POSITION_X_RATIOS = { 0: 0.25, 1: 0.5, 2: 0.75 }
    if (positionIdx != null && POSITION_X_RATIOS[positionIdx] !== undefined) {
      spine.x = this.manager.width * POSITION_X_RATIOS[positionIdx]
    } else {
      spine.x = this.manager.width * 0.5
    }
    spine.y = this.manager.height + 20
  }

  setSpinePositionByGameCoord(idolId, posX, posY = 0, baseY = null) {
    const entry = this.manager.spineInstances[idolId]
    if (!entry) return
    if (entry._slideTweenRaf) {
      cancelAnimationFrame(entry._slideTweenRaf)
      entry._slideTweenRaf = null
    }
    const centerX = this.manager.width / 2
    const yBase = baseY != null ? baseY : this.manager.height + 20
    const coordScale = this.manager.width / 1280
    entry.spine.x = centerX + posX * coordScale
    entry.spine.y = yBase - posY * coordScale
  }

  bringToFront(idolId) {
    const entry = this.manager.spineInstances[idolId]
    if (!entry) return
    this.manager.spineContainer.setChildIndex(entry.wrapper, this.manager.spineContainer.children.length - 1)
  }

  applySpineOrder(idolIds = []) {
    const orderedEntries = []
    for (const idolId of idolIds) {
      const entry = this.manager.spineInstances[idolId]
      if (entry?.wrapper?.parent === this.manager.spineContainer) {
        orderedEntries.push(entry)
      }
    }
    orderedEntries.forEach((entry, index) => {
      this.manager.spineContainer.setChildIndex(entry.wrapper, index)
    })
  }

  setSpinePartsVisible(idolId, visible) {
    const entry = this.manager.spineInstances[idolId]
    if (!entry?.spine) return
    entry.spine._partsVisible = visible !== false
    this._applyOptionalPartsSlots(entry.spine)
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
    const entry = Object.values(this.manager.spineInstances).find(e => e.spine === spine)
    const target = entry?.wrapper || spine
    const alphaFilter = this._wholeModelAlphaFilter(target, 0)
    target.alpha = 1
    target.visible = true
    const durationMs = Math.max(0.01, Number(duration) || 0.3) * 1000
    const start = performance.now()
    const ticker = () => {
      if (target.destroyed) {
        this.manager.app.ticker.remove(ticker)
        return
      }
      const t = Math.min((performance.now() - start) / durationMs, 1)
      alphaFilter.enabled = true
      alphaFilter.alpha = t
      if (t >= 1) {
        this.manager.app.ticker.remove(ticker)
        alphaFilter.enabled = false
      }
    }
    this.manager.app.ticker.add(ticker)
  }

  animateSpineAlpha(idolId, targetAlpha, duration = 0.2, delay = 0) {
    const entry = this.manager.spineInstances[idolId]
    if (!entry) return
    const target = entry.wrapper || entry.spine
    if (!target || target.destroyed) return
    entry._alphaTween?.cancel?.()
    const alphaFilter = this._wholeModelAlphaFilter(target, target.visible ? 1 : 0)
    const startAlpha = Number.isFinite(alphaFilter.alpha) ? alphaFilter.alpha : 1
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
        if (!target.destroyed) {
          alphaFilter.enabled = true
          alphaFilter.alpha = alpha
        }
      },
      shouldStop: () => target.destroyed,
      onComplete: () => {
        if (!target.destroyed) {
          if (endAlpha <= 0) target.visible = false
          else if (endAlpha >= 1) alphaFilter.enabled = false
        }
        entry._alphaTween = null
      },
    })
    if (endAlpha > 0) target.visible = true
  }

  setSpineAlpha(idolId, alpha) {
    const entry = this.manager.spineInstances[idolId]
    if (!entry) return
    const target = entry.wrapper || entry.spine
    if (!target || target.destroyed) return
    entry._alphaTween?.cancel?.()
    entry._alphaTween = null
    const value = Math.max(0, Math.min(1, Number(alpha)))
    const alphaFilter = this._wholeModelAlphaFilter(target, value)
    alphaFilter.alpha = value
    alphaFilter.enabled = value > 0 && value < 1
    target.alpha = 1
    target.visible = value > 0
  }

  _wholeModelAlphaFilter(target, initialAlpha = 1) {
    if (target._wholeModelAlpha && !target._wholeModelAlpha.destroyed) {
      target._wholeModelAlpha.resolution = this.manager.app?.renderer?.resolution || 1
      target._wholeModelAlpha.multisample = PIXI.MSAA_QUALITY.MEDIUM
      return target._wholeModelAlpha
    }
    const filter = new PIXI.AlphaFilter(initialAlpha)
    filter.resolution = this.manager.app?.renderer?.resolution || 1
    filter.multisample = PIXI.MSAA_QUALITY.MEDIUM
    const previousFilters = Array.isArray(target.filters) ? target.filters.filter(Boolean) : []
    target.filters = [...previousFilters, filter]
    target._wholeModelAlpha = filter
    return filter
  }

  bringSpineToTop(idolId) {
    const entry = this.manager.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry
    const parent = spine.parent
    if (parent) parent.setChildIndex(spine, parent.children.length - 1)
  }

  playSpineAnim(idolId, animName, skipChain = false, noBack = false, motionSetting = null, forceRestart = false, transitionMix = null) {
    const entry = this.manager.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry
    try {
      const allAnims = spine.state.data.skeletonData.animations.map(a => a.name)
      if (!forceRestart && spine._currentBodyAnim === animName) return

      let track = null
      if (animName.endsWith('_loop')) {
        track = spine.state.setAnimation(0, animName, true)
      } else if (skipChain || noBack) {
        track = spine.state.setAnimation(0, animName, false)
      } else {
        const loopVariant = animName + '_loop'
        const officialPose = motionSetting?.pose || ''
        const fallback = officialPose && allAnims.includes(officialPose)
          ? officialPose
          : allAnims.includes(loopVariant)
            ? loopVariant
            : 'wait_loop'

        track = spine.state.setAnimation(0, animName, false)
        if (allAnims.includes(fallback)) {
          spine.state.addAnimation(0, fallback, true, 0)
        }
      }
      if (track && Number.isFinite(transitionMix)) {
        track.mixDuration = Math.max(0, transitionMix)
      }
      spine._currentBodyAnim = animName
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to play anim "${animName}" on "${idolId}":`, err.message)
    }
  }

  switchSpineAnim(idolId, animName) {
    const entry = this.manager.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry
    try {
      const allAnims = spine.state.data.skeletonData.animations.map(a => a.name)
      if (!allAnims.includes(animName)) {
        console.warn(`[PixiStageManager] Anim "${animName}" not found on "${entry.modelId}"`)
        return
      }
      const isLoop = animName.endsWith('_loop')
      const track = spine.state.setAnimation(0, animName, isLoop)
      if (track) track.mixDuration = 0.3
      spine._currentBodyAnim = animName
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to switch anim "${animName}" on "${idolId}":`, err.message)
    }
  }

  playSpineNeckAnim(idolId, animName, eventKey = '') {
    const entry = this.manager.spineInstances[idolId]
    if (!entry?.spine) return
    const { spine } = entry
    try {
      const allAnims = spine.state.data.skeletonData.animations.map(a => a.name)
      if (!allAnims.includes(animName)) {
        console.warn(`[PixiStageManager] Neck anim "${animName}" not found on "${entry.modelId}"`)
        return
      }
      if (eventKey && spine._lastNeckEventKey === eventKey) return
      if (!eventKey && spine._currentNeckAnim === animName) return

      const playbackToken = (spine._neckPlaybackToken || 0) + 1
      spine._neckPlaybackToken = playbackToken
      spine._lastNeckEventKey = eventKey || ''
      const track = spine.state.setAnimation(3, animName, false)
      spine._currentNeckAnim = animName
      if (track) {
        // SideM neck clips contain offsets authored around the setup pose. They
        // are an additive performance layer over the current body animation;
        // replace blending would snap hello/angry poses back to setup at t=0.
        track.mixBlend = MixBlend.add
        track.mixDuration = 0
        const previousTargets = spine._neckAdditiveTargets || { boneIndices: [], deformSlotIndices: [] }
        const boneIndices = new Set(previousTargets.boneIndices)
        const deformSlotIndices = new Set(previousTargets.deformSlotIndices)
        for (const timeline of track.animation?.timelines || []) {
          if (Number.isInteger(timeline?.boneIndex)) boneIndices.add(timeline.boneIndex)
          if (timeline?.constructor?.name?.includes('Deform') && Number.isInteger(timeline.slotIndex)) {
            deformSlotIndices.add(timeline.slotIndex)
          }
        }
        spine._neckAdditiveTargets = {
          boneIndices: [...boneIndices],
          deformSlotIndices: [...deformSlotIndices],
        }
        spine._neckAdditiveCleanupPending = false
        track.listener = {
          complete: () => {
            if (spine._neckPlaybackToken !== playbackToken) return
            // A raw neck command owns a pose, not merely a timed gesture.
            // Clamp the last frame until another neck command, an explicit
            // neck stop, character removal, or a navigation restore replaces it.
            track.trackTime = track.animationEnd
          },
        }
      }
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to play neck anim "${animName}" on "${idolId}":`, err.message)
    }
  }

  stopSpineNeckAnim(idolId, eventKey = '') {
    const entry = this.manager.spineInstances[idolId]
    if (!entry?.spine) return
    try {
      const { spine } = entry
      if (eventKey && spine._lastNeckStopEventKey === eventKey) return
      spine._lastNeckStopEventKey = eventKey || ''
      spine._neckPlaybackToken = (spine._neckPlaybackToken || 0) + 1
      spine.state.clearTrack(3)
      spine._currentNeckAnim = null
      if (spine._neckAdditiveTargets) spine._neckAdditiveCleanupPending = true
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to stop neck anim on "${idolId}":`, err.message)
    }
  }

  removeSpine(idolId, immediate = false) {
    this._fadeOutAndDestroy(idolId, immediate)
  }

  clearAllSpines() {
    this.manager.lipSyncController.clearPending()
    this.manager._pendingTalking = this.manager.lipSyncController.pendingTalking
    this.manager.resetCameraZoom()
    const wrappers = []
    for (const idolId of Object.keys(this.manager.spineInstances)) {
      this.manager._spawnTokens[idolId] = (this.manager._spawnTokens[idolId] || 0) + 1
      const entry = this.manager.spineInstances[idolId]
      delete this.manager.spineInstances[idolId]
      if (entry) {
        if (entry.spine) entry.spine.customIsTalking = false
        if (entry._slideTweenRaf) {
          cancelAnimationFrame(entry._slideTweenRaf)
          entry._slideTweenRaf = null
        }
        entry._alphaTween?.cancel?.()
        entry._alphaTween = null
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
        this.manager._cleanupDebugRefs(idolId)
        wrappers.push(entry.wrapper || entry.spine)
      }
    }

    for (const wrapper of wrappers) {
      this._fadeOutWrapper(wrapper)
    }
  }

  _fadeOutWrapper(wrapper) {
    if (!wrapper || wrapper.destroyed) return
    wrapper._alphaTween?.cancel?.()
    const alphaFilter = this._wholeModelAlphaFilter(wrapper, wrapper.visible ? 1 : 0)
    alphaFilter.enabled = true
    wrapper.alpha = 1
    wrapper.visible = true
    wrapper._alphaTween = runRafTween({
      durationMs: 200,
      startValue: Number.isFinite(alphaFilter.alpha) ? alphaFilter.alpha : 1,
      endValue: 0,
      ease: easeOutCubic,
      onUpdate: alpha => {
        if (!wrapper.destroyed) alphaFilter.alpha = alpha
      },
      shouldStop: () => wrapper.destroyed,
      onComplete: () => {
        if (wrapper.destroyed) return
        wrapper.visible = false
        const parent = wrapper.parent
        if (parent) parent.removeChild(wrapper)
        wrapper.destroy({ children: true, texture: false, baseTexture: false })
      },
    })
  }

  _destroyWrapperNow(wrapper) {
    if (!wrapper || wrapper.destroyed) return
    const parent = wrapper.parent
    if (parent) parent.removeChild(wrapper)
    wrapper._alphaTween?.cancel?.()
    wrapper.destroy({ children: true, texture: false, baseTexture: false })
  }

  _destroySpineMarker(idolId) {
    const entry = this.manager.spineInstances[idolId]
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
    this.manager._spawnTokens[idolId] = (this.manager._spawnTokens[idolId] || 0) + 1
    delete this.manager._pendingTalking[idolId]
    const entry = this.manager.spineInstances[idolId]
    if (!entry) return
    const { spine, wrapper } = entry

    if (entry._slideTweenRaf) {
      cancelAnimationFrame(entry._slideTweenRaf)
      entry._slideTweenRaf = null
    }
    entry._alphaTween?.cancel?.()
    entry._alphaTween = null

    spine.customIsTalking = false
    this._destroySpineMarker(idolId)
    this._cleanupDebugRefs(idolId)
    delete this.manager.spineInstances[idolId]

    if (immediate) this._destroyWrapperNow(wrapper || spine)
    else this._fadeOutWrapper(wrapper || spine)
  }
}
