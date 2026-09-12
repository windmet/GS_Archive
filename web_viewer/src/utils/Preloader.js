/** Native cache warming driven solely by StoryAssetPlan. Logical closure,
 * fetched bytes, image load and renderer readiness are distinct. Unsupported
 * requirements stay pending; no Pixi or audio runtime is imported here. */
import { storyAssetAdapter, resolveStaticSpineModels } from './StoryAssetAdapters.js'
import { decodeSpineAtlasText, resolveSpineAtlasDependencies } from '../../shared/story/SpineAtlasPages.js'
import { resolveSpineTextureUrl } from './SpineTextureUrl.js'
import { validateStoryConfig } from './StoryConfigShape.js'
import { assetPriority, priorityRank } from '../../shared/story/StoryAssetPriority.js'

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

  static async preloadScenario(plan, onProgress, { signal, onStatus, priority, entryOnly = false } = {}) {
    signal?.throwIfAborted()
    if (plan?.schema_version !== 1 || !plan.source?.sha256 || !Array.isArray(plan.assets)) {
      throw new TypeError('Preloader requires a source-bound StoryAssetPlan')
    }
    plan = resolveStaticSpineModels(plan)
    const makeOutcome = asset => ({ key: asset.key, kind: asset.kind, id: asset.id, priority: assetPriority(asset, priority),
      uses: asset.uses.map(use => ({ ...use })), dependencies: [...asset.dependencies],
      atlasSource: asset.atlasSource && structuredClone(asset.atlasSource),
      dependencyState: asset.dependencyState, ...storyAssetAdapter(asset), error: null })
    const outcomes = plan.assets.map(makeOutcome)
    const tasks = outcomes.filter(task => task.state === 'discovered')
    const snapshot = phase => {
      const succeeded = outcomes.filter(task => ['image-loaded', 'fetched', 'atlas-parsed', 'json-parsed'].includes(task.state)).length
      const failed = outcomes.filter(task => task.state === 'failed').length
      const cancelled = outcomes.filter(task => task.state === 'cancelled').length
      const excluded = outcomes.filter(task => task.state === 'excluded').length
      const deferred = outcomes.filter(task => task.state === 'deferred').length
      return { phase, scope: 'story-asset-plan', source: { ...plan.source },
        priority: priority && structuredClone(priority),
        dependenciesComplete: plan.dependenciesComplete,
        unresolved: plan.unresolved.map(issue => ({ ...issue })), excluded, deferred,
        total: outcomes.length, succeeded, failed, cancelled,
        pending: outcomes.length - succeeded - failed - cancelled - excluded,
        tasks: structuredClone(outcomes) }
    }
    const report = phase => {
      const value = snapshot(phase)
      onStatus?.(value)
      return value
    }
    report('warming')
    const updatePriority = next => {
      if (signal?.aborted) return false
      priority = structuredClone(next)
      for (const task of tasks) {
        if (task.state === 'discovered') task.priority = assetPriority(task, priority)
      }
      report('background-warming')
      return true
    }
    let background
    const run = async stopAtEntry => {
    try {
      // Process in batches to avoid flooding network.
      const BATCH_SIZE = 6
      while (tasks.some(task => task.state === 'discovered')) {
        signal?.throwIfAborted()
        const pending = tasks.filter(task => task.state === 'discovered')
          .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
        if (stopAtEntry && pending[0].priority !== 'critical') {
          return { plan, status: report('entry-warmed'), updatePriority, startBackground: () => background ||= run(false) }
        }
        // Finish the active tier (including newly discovered atlas pages)
        // before lower-priority work can occupy a slot.
        const batch = pending.filter(task => task.priority === pending[0].priority).slice(0, BATCH_SIZE)
        await Promise.all(batch.map(async outcome => {
          outcome.state = 'loading'
          try {
            if (outcome.operation === 'json') {
              await this._preloadConfig(outcome, signal)
              outcome.state = 'json-parsed'
            } else if (outcome.operation === 'atlas') {
              const { text, sha256 } = await this._preloadAtlas(outcome.url, signal)
              signal?.throwIfAborted()
              plan = resolveSpineAtlasDependencies(plan, { modelId: outcome.id, atlasText: text, atlasSha256: sha256, modelKind: 'spine' })
              const bundle = plan.assets.find(asset => asset.key === `spine-bundle:${outcome.id}`)
              const bundleOutcome = outcomes.find(task => task.key === bundle.key)
              Object.assign(bundleOutcome, { dependencies: [...bundle.dependencies], dependencyState: 'complete',
                atlasSource: structuredClone(bundle.atlasSource), reason: 'renderer-pending:spine-bundle' })
              for (const asset of plan.assets) {
                if (outcomes.some(task => task.key === asset.key)) continue
                const added = makeOutcome(asset)
                added.allowFallback = bundle.atlasSource.pages.length === 1
                outcomes.push(added)
                tasks.push(added)
              }
              outcome.state = 'atlas-parsed'
              outcome.atlasSource = { sha256 }
            } else if (outcome.operation === 'spine-page') {
              outcome.url = await this._resolvePage(outcome, signal)
              signal?.throwIfAborted()
              outcome.state = await this._preloadImage(outcome.url, { signal })
            } else {
              outcome.state = outcome.operation === 'image'
                ? await this._preloadImage(outcome.url, { signal })
                : await this._preloadBinary(outcome.url, outcome.key, signal)
            }
          }
          catch (error) {
            outcome.state = signal?.aborted ? 'cancelled' : 'failed'
            outcome.error = String(error?.message || error)
          }
          if (!signal?.aborted) {
            const value = report(entryOnly && !stopAtEntry ? 'background-warming' : 'warming')
            // Compatibility callback measures successful warming tasks only.
            // UI consumes structured status, not this subset percentage.
            onProgress?.(Math.round(value.succeeded / tasks.length * 100))
          }
        }))
        signal?.throwIfAborted()
        if ((!entryOnly || stopAtEntry) && outcomes.some(task => task.priority === 'critical' && task.state === 'failed')) {
          return { plan, status: report('blocked') }
        }
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
    return run(entryOnly)
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

  static async _preloadAtlas(url, signal) {
    return withTimeout(async taskSignal => {
      const response = await fetch(url, { signal: taskSignal })
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`)
      const bytes = await response.arrayBuffer()
      if (!bytes.byteLength) throw new Error(`Empty atlas: ${url}`)
      const hash = await crypto.subtle.digest('SHA-256', bytes)
      return { text: decodeSpineAtlasText(bytes), sha256: `sha256:${Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')}` }
    }, TIMEOUT_MS, `atlas ${url}`, signal)
  }

  static async _preloadConfig(task, signal) {
    task.attempts = []
    return withTimeout(async taskSignal => {
      for (let index = 0; index < task.urls.length; index++) {
        taskSignal.throwIfAborted()
        const url = task.urls[index]
        const response = await fetch(url, { signal: taskSignal, cache: task.cache })
        task.attempts.push({ url, status: response.status })
        if (!response.ok) {
          await response.body?.cancel()
          if (index + 1 < task.urls.length) continue
          throw new Error(`HTTP ${response.status}: ${url}`)
        }
        validateStoryConfig(task.kind, await response.json())
        task.url = url
        return
      }
      throw new Error(`No config candidates: ${task.key}`)
    }, TIMEOUT_MS, `config ${task.key}`, signal)
  }

  static async _resolvePage(task, signal) {
    return withTimeout(taskSignal => resolveSpineTextureUrl(task.atlasSource.modelId, task.atlasSource.page, {
      allowFallback: task.allowFallback,
      probe: async url => {
        try {
          const response = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: taskSignal })
          return response.ok && (response.headers.get('content-type') || '').startsWith('image/')
        } catch (error) {
          taskSignal.throwIfAborted()
          return false
        }
      },
    }), TIMEOUT_MS, `page ${task.id}`, signal)
  }

}
