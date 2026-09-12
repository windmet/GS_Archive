/**
 * Legacy best-effort background/skeleton cache warming. This scans step.state,
 * so it does not enumerate authoritative v2 snapshots or complete Spine bundles.
 *
 * Key principle: NEVER dynamically import pixi.js here. Use native Image/fetch
 * to attempt cache warming. Cache reuse, decoding and render readiness are not
 * guaranteed. Task outcomes describe only this limited warming pass, never the
 * complete episode or renderer readiness. Failures stay separate from successes.
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
   * Attempt the legacy background/skeleton subset for these steps.
   * Uses Image() for backgrounds and fetch() for spine binaries
   * to populate the browser's HTTP cache.
   *
   * @param {Array} steps - scenario steps array
   * @param {function} onProgress - callback(percent: 0-100)
   * @returns {Promise<object>} scanned assets and the final warming report
   */
  static async preloadScenario(steps, onProgress, { signal, onStatus } = {}) {
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

    const outcomes = tasks.map(task => ({ key: `${task.type}:${task.id}`, kind: task.type,
      id: task.id, state: 'discovered', error: null }))
    const snapshot = phase => {
      const succeeded = outcomes.filter(task => ['image-loaded', 'fetched'].includes(task.state)).length
      const failed = outcomes.filter(task => task.state === 'failed').length
      const cancelled = outcomes.filter(task => task.state === 'cancelled').length
      return { phase, scope: 'legacy-cache-warm', dependenciesComplete: false,
        total: outcomes.length, succeeded, failed, cancelled,
        pending: outcomes.length - succeeded - failed - cancelled,
        tasks: outcomes.map(task => ({ ...task })) }
    }
    const report = phase => {
      const value = snapshot(phase)
      onStatus?.(value)
      return value
    }
    report('warming')
    try {
      // Process in batches to avoid flooding network.
      const BATCH_SIZE = 6
      for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
        signal?.throwIfAborted()
        await Promise.all(tasks.slice(i, i + BATCH_SIZE).map(async (task, offset) => {
          const outcome = outcomes[i + offset]
          outcome.state = 'loading'
          try { outcome.state = await task.load() }
          catch (error) {
            outcome.state = signal?.aborted ? 'cancelled' : 'failed'
            outcome.error = String(error?.message || error)
          }
          if (!signal?.aborted) {
            const value = report('warming')
            // Compatibility callback measures successful warming tasks only.
            // UI consumes structured status, not this subset percentage.
            onProgress?.(Math.round(value.succeeded / value.total * 100))
          }
        }))
        signal?.throwIfAborted()
      }
    } catch (error) {
      for (const task of outcomes) {
        if (['discovered', 'loading'].includes(task.state)) task.state = 'cancelled'
      }
      report('cancelled')
      throw error
    }
    const status = report(outcomes.some(task => task.state === 'failed') ? 'partial' : 'settled')
    return { ...assets, status }
  }

  // ── Internal loaders: all use native browser APIs, NO pixi.js ──

  /**
   * Preload an image into browser cache using Image object.
   * onload proves an image load only; no GPU readiness or retained decode claim.
   */
  static _preloadImage(url, { signal } = {}) {
    return withTimeout(taskSignal => new Promise((resolve, reject) => {
      const img = new Image()
      const cleanup = () => {
        img.onload = img.onerror = img.onabort = null
        taskSignal.removeEventListener('abort', abort)
      }
      const finish = () => { cleanup(); resolve('image-loaded') }
      const fail = () => { cleanup(); reject(new Error(`Image load failed: ${url}`)) }
      const abort = () => { cleanup(); img.removeAttribute('src'); reject(taskSignal.reason) }
      taskSignal.addEventListener('abort', abort, { once: true })
      img.onload = finish
      img.onerror = fail
      img.onabort = fail
      img.src = url
    }), TIMEOUT_MS, `image ${url}`, signal)
  }

  static async _preloadSpine(modelId, { signal } = {}) {
    return this._preloadBinary(getSpineSkelUrl(modelId), `spine ${modelId}`, signal)
  }

  static async _preloadBinary(url, label, signal) {
    return withTimeout(async taskSignal => {
      const response = await fetch(url, { signal: taskSignal })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${url}`)
      }
      const body = await response.blob()
      if (!body.size) throw new Error(`Empty response: ${url}`)
      return 'fetched'
    }, TIMEOUT_MS, label, signal)
  }

  static async _preloadAudio(voiceFile, { signal } = {}) {
    return this._preloadBinary(getVoiceUrl(voiceFile), `voice ${voiceFile}`, signal)
  }
}
