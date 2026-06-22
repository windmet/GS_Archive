/**
 * Preloader — scan scenario steps for required assets and preload them
 * into the browser's HTTP cache so that PIXI.Assets.load() resolves instantly.
 *
 * Key principle: NEVER dynamically import pixi.js here. Use native Image/fetch
 * to warm the browser cache, then PIXI.Assets.load() in PixiStageManager will
 * be a cache hit (near-zero latency).
 *
 * This runs ONLY when user clicks a scenario file (in App.vue loadScenario).
 * Home screen / list views never touch this code.
 *
 * Safety: every operation has a timeout. No single asset can hang the flow.
 */

import { getBgUrl, getVoiceUrl, getSpineSkelUrl } from './AssetResolver.js'

const TIMEOUT_MS = 10000 // 10s per asset max

/**
 * Wraps a promise with a timeout. If it doesn't settle within `ms`,
 * it rejects with a TimeoutError so the catch handler can fire.
 */
function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`[Preloader] timeout (${ms}ms): ${label}`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export class Preloader {

  /**
   * Scan all steps and classify asset requirements.
   */
  static scanStepAssets(steps) {
    const bgIds = new Set()
    const voiceFiles = new Set()
    const spineModels = new Set()

    for (const step of steps) {
      const state = step.state || {}
      if (state.bg) bgIds.add(state.bg)
      if (step.dialogue?.voice) voiceFiles.add(step.dialogue.voice)
      for (const spine of state.spines || []) {
        if (spine.model) spineModels.add(spine.model)
      }
    }

    return {
      bgIds: [...bgIds],
      voiceFiles: [...voiceFiles],
      spineModels: [...spineModels],
    }
  }

  /**
   * Preload all assets for a scenario's steps into browser cache.
   * Uses Image() for backgrounds and fetch() for spine binaries
   * to populate the browser's HTTP cache.
   *
   * @param {Array} steps - scenario steps array
   * @param {function} onProgress - callback(percent: 0-100)
   * @returns {Promise<{ bgIds: string[], voiceFiles: string[], spineModels: string[] }>}
   */
  static async preloadScenario(steps, onProgress) {
    const assets = this.scanStepAssets(steps)

    // Build a flat task list
    const tasks = []

    // Background images → Image() preload (browser HTTP cache)
    for (const bgId of assets.bgIds) {
      tasks.push({ type: 'bg', id: bgId, load: () => this._preloadImage(getBgUrl(bgId)) })
    }

    // Spine skeletons → fetch() preload .skel only (PIXI spine loader resolves atlas+png)
    for (const modelId of assets.spineModels) {
      tasks.push({ type: 'spine', id: modelId, load: () => this._preloadSpine(modelId) })
    }

    // Voice files → 跳过预加载！IDM 会嗅探 .m4a 并返回 stub，
    // 导致后续 playVoice 的 fetch() 拿到空数据。
    // 改为在 playVoice 中按需 fetch + cache-busting

    const total = tasks.length
    if (total === 0) {
      if (onProgress) onProgress(100)
      return assets
    }

    let completed = 0

    const report = () => {
      completed++
      if (onProgress) onProgress(Math.round((completed / total) * 100))
    }

    // Process in batches to avoid flooding network
    const BATCH_SIZE = 6
    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      const batch = tasks.slice(i, i + BATCH_SIZE)
      await Promise.allSettled(batch.map(t => t.load().then(report).catch(report)))
    }

    return assets
  }

  // ── Internal loaders: all use native browser APIs, NO pixi.js ──

  /**
   * Preload an image into browser cache using Image object.
   * If 404 or timeout, just warn and resolve — never hang.
   */
  static _preloadImage(url) {
    return withTimeout(new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve()
      img.onerror = () => {
        console.warn(`[Preloader] bg 404: ${url}`)
        resolve()
      }
      img.onabort = () => {
        console.warn(`[Preloader] bg aborted: ${url}`)
        resolve()
      }
      img.src = url
    }), TIMEOUT_MS, `image ${url}`).catch((err) => {
      console.warn(err.message)
    })
  }

  /**
   * Preload spine model file (.skel) via fetch.
   * The PIXI spine loader resolves .atlas and .png from the .skel path.
   */
  static async _preloadSpine(modelId) {
    const skelUrl = getSpineSkelUrl(modelId)
    const label = `spine ${modelId}`
    try {
      const res = await withTimeout(fetch(skelUrl), TIMEOUT_MS, label)
      if (!res.ok) {
        console.warn(`[Preloader] ${label} 404: ${skelUrl}`)
        return
      }
      // Consume the body to populate browser cache
      await withTimeout(res.blob(), TIMEOUT_MS, `${label} blob`)
    } catch (err) {
      console.warn(`[Preloader] ${label} failed: ${err.message}`)
    }
  }

  /**
   * Preload a voice audio file via fetch to populate browser HTTP cache.
   * Uses fetch + blob (NOT HTML5 Audio) to avoid triggering IDM sniffing.
   * Web Audio API in playVoice() uses fetch() which will hit cache.
   */
  static async _preloadAudio(voiceFile) {
    const url = getVoiceUrl(voiceFile)
    const label = `voice ${voiceFile}`
    try {
      const res = await withTimeout(fetch(url), TIMEOUT_MS, label)
      if (!res.ok) {
        console.warn(`[Preloader] voice 404: ${url}`)
        return
      }
      // Consume body to populate browser HTTP cache
      await withTimeout(res.blob(), TIMEOUT_MS, `${label} blob`)
    } catch (err) {
      console.warn(`[Preloader] ${label} failed: ${err.message}`)
    }
  }
}
