/** Native cache warming driven solely by StoryAssetPlan. Logical closure,
 * fetched bytes, image load and renderer readiness are distinct. Unsupported
 * requirements stay pending; no Pixi or audio runtime is imported here. */
import { storyAssetAdapter } from './StoryAssetAdapters.js'

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

  static async preloadScenario(plan, onProgress, { signal, onStatus } = {}) {
    signal?.throwIfAborted()
    if (plan?.schema_version !== 1 || !plan.source?.sha256 || !Array.isArray(plan.assets)) {
      throw new TypeError('Preloader requires a source-bound StoryAssetPlan')
    }
    const outcomes = plan.assets.map(asset => ({ key: asset.key, kind: asset.kind, id: asset.id,
      uses: asset.uses.map(use => ({ ...use })), dependencies: [...asset.dependencies],
      dependencyState: asset.dependencyState, ...storyAssetAdapter(asset), error: null }))
    const tasks = outcomes.filter(task => task.state === 'discovered')
    const snapshot = phase => {
      const succeeded = outcomes.filter(task => ['image-loaded', 'fetched'].includes(task.state)).length
      const failed = outcomes.filter(task => task.state === 'failed').length
      const cancelled = outcomes.filter(task => task.state === 'cancelled').length
      const excluded = outcomes.filter(task => task.state === 'excluded').length
      const deferred = outcomes.filter(task => task.state === 'deferred').length
      return { phase, scope: 'story-asset-plan', source: { ...plan.source },
        dependenciesComplete: plan.dependenciesComplete,
        unresolved: plan.unresolved.map(issue => ({ ...issue })), excluded, deferred,
        total: outcomes.length, succeeded, failed, cancelled,
        pending: outcomes.length - succeeded - failed - cancelled - excluded,
        tasks: outcomes.map(task => ({ ...task, uses: task.uses.map(use => ({ ...use })), dependencies: [...task.dependencies] })) }
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
        await Promise.all(tasks.slice(i, i + BATCH_SIZE).map(async outcome => {
          outcome.state = 'loading'
          try {
            outcome.state = outcome.operation === 'image'
              ? await this._preloadImage(outcome.url, { signal })
              : await this._preloadBinary(outcome.url, outcome.key, signal)
          }
          catch (error) {
            outcome.state = signal?.aborted ? 'cancelled' : 'failed'
            outcome.error = String(error?.message || error)
          }
          if (!signal?.aborted) {
            const value = report('warming')
            // Compatibility callback measures successful warming tasks only.
            // UI consumes structured status, not this subset percentage.
            onProgress?.(Math.round(value.succeeded / tasks.length * 100))
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
    const status = report(outcomes.some(task => task.state === 'failed') ? 'partial'
      : !plan.dependenciesComplete || outcomes.some(task => task.state === 'deferred') ? 'pending' : 'settled')
    return { plan, status }
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

}
