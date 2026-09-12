/**
 * Legacy best-effort background/skeleton cache warming. This scans step.state,
 * so it does not enumerate authoritative v2 snapshots or complete Spine bundles.
 *
 * Key principle: NEVER dynamically import pixi.js here. Use native Image/fetch
 * to attempt cache warming. Cache reuse, decoding and render readiness are not
 * guaranteed. The percentage currently counts settled attempts, including failures.
 * StoryAssetPlan is being developed separately before replacing this executor.
 *
 * This runs ONLY when user clicks a scenario file (in App.vue loadScenario).
 * Home screen / list views never touch this code.
 *
 * Safety: every operation has a timeout and navigation-owned abort signal.
 * Cancellation clears pending work and prevents later batches/progress.
 */

import { getBgUrl, getVoiceUrl, getSpineSkelUrl } from './AssetResolver.js'

const TIMEOUT_MS = 10000 // 10s per asset max

/**
 * Owns the task timeout and abort signal for the complete body/image load.
 * Cancellation rejects promptly even when an adapter cannot stop its work.
 */
async function withTimeout(load, ms, label, signal) {
  signal?.throwIfAborted()
  const controller = new AbortController()
  const forwardAbort = () => controller.abort(signal.reason)
  signal?.addEventListener('abort', forwardAbort, { once: true })
  const timer = setTimeout(() => controller.abort(new Error(`[Preloader] timeout (${ms}ms): ${label}`)), ms)
  let onAbort
  try {
    return await Promise.race([
      Promise.resolve().then(() => { controller.signal.throwIfAborted(); return load(controller.signal) }),
      new Promise((_, reject) => {
        onAbort = () => reject(controller.signal.reason)
        controller.signal.addEventListener('abort', onAbort, { once: true })
      }),
    ])
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
    controller.signal.removeEventListener('abort', onAbort)
  }
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
  static async preloadScenario(steps, onProgress, { signal } = {}) {
    signal?.throwIfAborted()
    const assets = this.scanStepAssets(steps)

    // Build a flat task list
    const tasks = []

    // Background images → Image() preload (browser HTTP cache)
    for (const bgId of assets.bgIds) {
      tasks.push({ type: 'bg', id: bgId, load: () => this._preloadImage(getBgUrl(bgId), { signal }) })
    }

    // Spine skeletons → fetch() preload .skel only (PIXI spine loader resolves atlas+png)
    for (const modelId of assets.spineModels) {
      tasks.push({ type: 'spine', id: modelId, load: () => this._preloadSpine(modelId, { signal }) })
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
      if (signal?.aborted) return
      completed++
      if (onProgress) onProgress(Math.round((completed / total) * 100))
    }

    // Process in batches to avoid flooding network
    const BATCH_SIZE = 6
    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      signal?.throwIfAborted()
      const batch = tasks.slice(i, i + BATCH_SIZE)
      await Promise.allSettled(batch.map(t => t.load().then(report).catch(report)))
      signal?.throwIfAborted()
    }

    return assets
  }

  // ── Internal loaders: all use native browser APIs, NO pixi.js ──

  /**
   * Preload an image into browser cache using Image object.
   * If 404 or timeout, just warn and resolve — never hang.
   */
  static _preloadImage(url, { signal } = {}) {
    return withTimeout(taskSignal => new Promise((resolve, reject) => {
      const img = new Image()
      const cleanup = () => {
        img.onload = img.onerror = img.onabort = null
        taskSignal.removeEventListener('abort', abort)
      }
      const finish = () => { cleanup(); resolve() }
      const abort = () => { cleanup(); img.removeAttribute('src'); reject(taskSignal.reason) }
      taskSignal.addEventListener('abort', abort, { once: true })
      img.onload = finish
      img.onerror = () => { console.warn(`[Preloader] bg failed: ${url}`); finish() }
      img.onabort = () => { console.warn(`[Preloader] bg aborted: ${url}`); finish() }
      img.src = url
    }), TIMEOUT_MS, `image ${url}`, signal).catch(error => {
      if (signal?.aborted) throw signal.reason
      console.warn(error.message)
    })
  }

  static async _preloadSpine(modelId, { signal } = {}) {
    return this._preloadBinary(getSpineSkelUrl(modelId), `spine ${modelId}`, signal)
  }

  static async _preloadBinary(url, label, signal) {
    try {
      await withTimeout(async taskSignal => {
        const response = await fetch(url, { signal: taskSignal })
        if (!response.ok) {
          console.warn(`[Preloader] ${label} HTTP ${response.status}: ${url}`)
          return
        }
        await response.blob()
      }, TIMEOUT_MS, label, signal)
    } catch (error) {
      if (signal?.aborted) throw signal.reason
      console.warn(`[Preloader] ${label} failed: ${error.message}`)
    }
  }

  static async _preloadAudio(voiceFile, { signal } = {}) {
    return this._preloadBinary(getVoiceUrl(voiceFile), `voice ${voiceFile}`, signal)
  }
}
