import { storyAssetTransport } from '../core/StoryAssetTransport.js'
import { withLoadDeadline } from '../core/AsyncLoadBoundary.js'
import { StoryWarmupQueue } from '../core/StoryWarmupQueue.js'
import { tracePlayer } from '../core/PlayerTrace.js'
import { storyAssetAdapter, resolveStaticSpineModels } from './StoryAssetAdapters.js'
import { decodeSpineAtlasText, resolveSpineAtlasDependencies } from '../../shared/story/SpineAtlasPages.js'
import { resolveSpineTextureUrl } from './SpineTextureUrl.js'
import { validateStoryConfig } from './StoryConfigShape.js'
import { assetPriority, priorityRank } from '../../shared/story/StoryAssetPriority.js'

const TIMEOUT_MS = 25000
const withTimeout = (load, ms, label, signal) => withLoadDeadline(load, { signal, timeoutMs: ms, label: `[Preloader] ${label}` })
const warmed = new Set(['image-loaded', 'fetched', 'atlas-parsed', 'json-parsed'])

/** Warming is an optimization. In runtimeOwned mode it performs no network work
 * before the renderer's first frame, and never drains deferred/far-future assets.
 * The explicit full/audit mode keeps its independent warming evidence contract. */
export class Preloader {
  static async preloadScenario(plan, onProgress, { signal, onStatus, priority, entryOnly = false, runtimeOwned = false } = {}) {
    signal?.throwIfAborted()
    if (plan?.schema_version !== 1 || !plan.source?.sha256 || !Array.isArray(plan.assets)) {
      throw new TypeError('Preloader requires a source-bound StoryAssetPlan')
    }
    plan = resolveStaticSpineModels(plan)
    const makeOutcome = asset => ({ key: asset.key, kind: asset.kind, id: asset.id, priority: assetPriority(asset, priority),
      uses: asset.uses.map(use => ({ ...use })), dependencies: [...asset.dependencies],
      atlasSource: asset.atlasSource && structuredClone(asset.atlasSource),
      dependencyState: asset.dependencyState, ...storyAssetAdapter(asset), error: null,
      ...(runtimeOwned && asset.kind === 'costume-dictionary'
        ? { state: 'excluded', required: false, reason: 'diagnostic-only-config' } : {}) })
    const outcomes = plan.assets.map(makeOutcome)
    const tasks = outcomes.filter(task => task.state === 'discovered')
    const snapshot = phase => {
      const count = state => outcomes.filter(task => task.state === state).length
      const succeeded = outcomes.filter(task => warmed.has(task.state)).length
      return { phase, scope: 'story-asset-plan', source: { ...plan.source },
        priority: priority && structuredClone(priority), runtimeOwned,
        dependenciesComplete: plan.dependenciesComplete, unresolved: plan.unresolved.map(issue => ({ ...issue })),
        total: outcomes.length, succeeded, failed: count('failed'), cancelled: count('cancelled'),
        excluded: count('excluded'), deferred: count('deferred'),
        pending: outcomes.filter(task => ['discovered', 'loading', 'deferred'].includes(task.state)).length,
        tasks: structuredClone(outcomes) }
    }
    const report = phase => {
      const value = snapshot(phase)
      onStatus?.(value)
      if (tasks.length) onProgress?.(Math.round(value.succeeded / tasks.length * 100))
      return value
    }
    const attempts = new WeakMap()
    const execute = async (target, taskSignal, bytesOnly = false) => {
      const token = {}
      attempts.set(target, token)
      const outcome = { ...target }
      outcome.state = 'loading'
      outcome.startedAt = performance.now()
      tracePlayer('warmup-request', { key: outcome.key, priority: outcome.priority, bytesOnly })
      try {
        taskSignal?.throwIfAborted()
        if (outcome.operation === 'json') {
          await this._preloadConfig(outcome, taskSignal)
          outcome.state = 'json-parsed'
        } else if (outcome.operation === 'atlas') {
          const { text, sha256 } = await this._preloadAtlas(outcome.url, taskSignal)
          taskSignal?.throwIfAborted()
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
            if (added.state === 'discovered') tasks.push(added)
          }
          outcome.state = 'atlas-parsed'
          outcome.atlasSource = { sha256 }
        } else if (outcome.operation === 'spine-page') {
          outcome.url = await this._resolvePage(outcome, taskSignal)
          taskSignal?.throwIfAborted()
          outcome.state = bytesOnly ? await this._preloadBinary(outcome.url, outcome.key, taskSignal)
            : await this._preloadImage(outcome.url, { signal: taskSignal })
        } else {
          outcome.state = outcome.operation === 'image' && !bytesOnly
            ? await this._preloadImage(outcome.url, { signal: taskSignal })
            : await this._preloadBinary(outcome.url, outcome.key, taskSignal)
        }
      } catch (error) {
        const yielded = taskSignal?.reason?.code === 'WARMUP_YIELD' || error?.code === 'WARMUP_YIELD'
        outcome.state = yielded ? 'discovered' : (signal?.aborted || taskSignal?.aborted) ? 'cancelled' : 'failed'
        outcome.error = yielded ? null : String(error?.message || error)
        outcome.errorCode = yielded ? null : error?.code || error?.name || 'LOAD_FAILED'
        outcome.retryable = !signal?.aborted && ['LOAD_TIMEOUT', 'TimeoutError', 'TypeError'].includes(outcome.errorCode)
      } finally {
        outcome.elapsedMs = Math.round(performance.now() - outcome.startedAt)
        if (attempts.get(target) !== token) return
        if (taskSignal?.aborted) outcome.state = taskSignal.reason?.code === 'WARMUP_YIELD' ? 'discovered' : 'cancelled'
        outcome.priority = assetPriority(target, priority)
        Object.assign(target, outcome)
        tracePlayer('warmup-settled', { key: outcome.key, state: outcome.state, elapsedMs: outcome.elapsedMs })
      }
    }
    let session = null
    const liveWindow = () => {
      if (session) return session
      const queue = new StoryWarmupQueue({ tasks, signal,
        priority: task => task.priority,
        eligible: task => runtimeOwned ? task.priority === 'near' : task.priority !== 'deferred',
        run: (task, taskSignal) => execute(task, taskSignal, true),
        report: () => report('background-warming'),
        concurrency: 2, imageConcurrency: 1,
      })
      session = { plan, status: report(runtimeOwned ? 'renderer-owned' : 'entry-warmed'),
        startBackground: () => queue.start(),
        setPaused: value => queue.setPaused(value), dispose: () => queue.dispose(),
        updatePriority: next => {
          if (signal?.aborted || queue.disposed) return false
          priority = structuredClone(next)
          for (const task of tasks) task.priority = assetPriority(task, priority)
          queue.update()
          report('background-warming')
          return true
        },
      }
      return session
    }
    if (runtimeOwned) return liveWindow()
    report('warming')
    try {
      while (tasks.some(task => task.state === 'discovered')) {
        signal?.throwIfAborted()
        const pending = tasks.filter(task => task.state === 'discovered').sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
        if (entryOnly && pending[0].priority !== 'critical') return liveWindow()
        const batch = pending.filter(task => task.priority === pending[0].priority).slice(0, 6)
        await Promise.all(batch.map(async outcome => {
          await execute(outcome, signal)
          if (!signal?.aborted) report('warming')
        }))
        signal?.throwIfAborted()
        if (outcomes.some(task => task.priority === 'critical' && task.state === 'failed')) {
          return { plan, status: report('blocked') }
        }
      }
    } catch (error) {
      for (const task of outcomes) if (['discovered', 'loading'].includes(task.state)) task.state = 'cancelled'
      report('cancelled')
      throw error
    }
    return { plan, status: report(outcomes.some(task => task.state === 'failed') ? 'partial'
      : !plan.dependenciesComplete || outcomes.some(task => task.state === 'deferred') ? 'pending' : 'settled') }
  }

  /** Full/audit mode only. Interactive speculation fetches bytes, not Image decodes. */
  static _preloadImage(url, { signal } = {}) {
    return withTimeout(taskSignal => new Promise((resolve, reject) => {
      const img = new Image()
      const cleanup = () => {
        img.onload = img.onerror = img.onabort = null
        taskSignal.removeEventListener('abort', abort)
      }
      const abort = () => { cleanup(); img.removeAttribute('src'); reject(taskSignal.reason) }
      taskSignal.addEventListener('abort', abort, { once: true })
      img.onload = () => { cleanup(); resolve('image-loaded') }
      img.onerror = img.onabort = () => {
        cleanup(); reject(Object.assign(new Error(`Image load failed: ${url}`), { code: 'IMAGE_LOAD_FAILED', phase: 'image' }))
      }
      img.crossOrigin = 'anonymous'
      img.src = url
    }), TIMEOUT_MS, `image ${url}`, signal)
  }
  static async _preloadBinary(url, label, signal) {
    return withTimeout(async taskSignal => {
      await storyAssetTransport.getArrayBuffer(url, { signal: taskSignal })
      return 'fetched'
    }, TIMEOUT_MS, label, signal)
  }
  static async _preloadAtlas(url, signal) {
    return withTimeout(async taskSignal => {
      const bytes = await storyAssetTransport.getArrayBuffer(url, { signal: taskSignal })
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
        let config
        try {
          config = await storyAssetTransport.getJson(url, { signal: taskSignal, cache: task.cache })
          task.attempts.push({ url, status: 200 })
        } catch (error) {
          if (error.status) task.attempts.push({ url, status: error.status })
          if ([404, 410].includes(error.status) && index + 1 < task.urls.length) continue
          throw error
        }
        validateStoryConfig(task.kind, config)
        task.url = url
        return
      }
      throw new Error(`No config candidates: ${task.key}`)
    }, TIMEOUT_MS, `config ${task.key}`, signal)
  }
  static async _resolvePage(task, signal) {
    return withTimeout(taskSignal => resolveSpineTextureUrl(task.atlasSource.modelId, task.atlasSource.page, {
      signal: taskSignal, allowFallback: task.allowFallback,
      probe: async url => {
        const response = await fetch(url, { method: 'HEAD', cache: 'default', signal: taskSignal })
        if (!response.ok && ![404, 410].includes(response.status)) throw new Error(`Texture probe HTTP ${response.status}`)
        return response.ok && (response.headers.get('content-type') || '').startsWith('image/')
      },
    }), TIMEOUT_MS, `page ${task.id}`, signal)
  }
}
