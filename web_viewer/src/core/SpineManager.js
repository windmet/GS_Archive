import * as PIXI from 'pixi.js'
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
    target.alpha = 0
    const durationMs = Math.max(0.01, Number(duration) || 0.3) * 1000
    const start = performance.now()
    const ticker = () => {
      if (target.destroyed) {
        this.manager.app.ticker.remove(ticker)
        return
      }
      const t = Math.min((performance.now() - start) / durationMs, 1)
      target.alpha = t
      if (t >= 1) {
        this.manager.app.ticker.remove(ticker)
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

  bringSpineToTop(idolId) {
    const entry = this.manager.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry
    const parent = spine.parent
    if (parent) parent.setChildIndex(spine, parent.children.length - 1)
  }

  playSpineAnim(idolId, animName, skipChain = false, noBack = false, motionSetting = null) {
    const entry = this.manager.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry
    try {
      const allAnims = spine.state.data.skeletonData.animations.map(a => a.name)
      if (spine._currentBodyAnim === animName) return

      if (animName.endsWith('_loop')) {
        spine.state.setAnimation(0, animName, true)
      } else if (skipChain || noBack) {
        spine.state.setAnimation(0, animName, false)
      } else {
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
      const savedMix = spine.stateData.defaultMix
      spine.stateData.defaultMix = 0.3
      spine.state.setAnimation(0, animName, isLoop)
      spine._currentBodyAnim = animName
      spine.stateData.defaultMix = savedMix
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to switch anim "${animName}" on "${idolId}":`, err.message)
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
    const alphaFilter = new PIXI.AlphaFilter(wrapper.alpha || 1.0)
    const previousFilters = Array.isArray(wrapper.filters) ? wrapper.filters.slice() : []
    wrapper.filters = [...previousFilters, alphaFilter]

    const STEP = 0.12
    const ticker = () => {
      if (wrapper.destroyed) {
        this.manager.app.ticker.remove(ticker)
        return
      }

      alphaFilter.alpha -= STEP

      if (alphaFilter.alpha <= 0) {
        this.manager.app.ticker.remove(ticker)
        wrapper.filters = previousFilters.length ? previousFilters : null
        const parent = wrapper.parent
        if (parent) parent.removeChild(wrapper)
        wrapper.destroy({ children: true, textures: true })
      }
    }
    this.manager.app.ticker.add(ticker)
  }

  _destroyWrapperNow(wrapper) {
    if (!wrapper || wrapper.destroyed) return
    const parent = wrapper.parent
    if (parent) parent.removeChild(wrapper)
    wrapper.destroy({ children: true, textures: true })
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

    spine.customIsTalking = false
    this._destroySpineMarker(idolId)
    this._cleanupDebugRefs(idolId)
    delete this.manager.spineInstances[idolId]

    if (immediate) this._destroyWrapperNow(wrapper || spine)
    else this._fadeOutWrapper(wrapper || spine)
  }
}
