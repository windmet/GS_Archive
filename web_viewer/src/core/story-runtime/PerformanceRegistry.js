const ACTIVE_STATUSES = new Set(['scheduled', 'running', 'paused'])

function asBoolean(value, fallback) {
  return value == null ? fallback : value === true
}
/**
 * Create a controllable performance with deterministic settle/cancel semantics.
 */
export function createPerformanceHandle({
  id,
  channel,
  status = 'scheduled',
  skippable = true,
  blocksInput = false,
  blocksAuto = true,
  onStart = null,
  onSettle = null,
  onCancel = null,
  onPause = null,
  onResume = null,
  metadata = {},
} = {}) {
  if (!id || typeof id !== 'string') throw new TypeError('performance id must be a non-empty string')
  if (!channel || typeof channel !== 'string') throw new TypeError('performance channel must be a non-empty string')
  if (!ACTIVE_STATUSES.has(status)) throw new TypeError(`unsupported initial performance status: ${status}`)

  let currentStatus = status
  let operation = null
  let operationKind = null
  let operationGeneration = 0
  let resolveFinished
  const finished = new Promise(resolve => { resolveFinished = resolve })

  async function transition(finalStatus, callback, reason) {
    if (!ACTIVE_STATUSES.has(currentStatus)) return currentStatus
    // Navigation/disposal must be able to interrupt an asynchronous Skip
    // settlement (for example, a Spine cue waiting for its model to load).
    if (operation && (finalStatus !== 'cancelled' || operationKind === 'cancelled')) return operation
    const generation = ++operationGeneration
    operationKind = finalStatus
    operation = (async () => {
      try {
        await callback?.(reason)
        if (generation !== operationGeneration) return currentStatus
        currentStatus = finalStatus
      } catch (error) {
        if (generation !== operationGeneration) return currentStatus
        currentStatus = 'failed'
        resolveFinished({ status: currentStatus, reason, error })
        throw error
      }
      resolveFinished({ status: currentStatus, reason })
      return currentStatus
    })()
    return operation
  }

  const handle = {
    id,
    channel,
    skippable: asBoolean(skippable, true),
    blocksInput: asBoolean(blocksInput, false),
    blocksAuto: asBoolean(blocksAuto, true),
    metadata: Object.freeze({ ...metadata }),
    finished,
    get status() { return currentStatus },
    get active() { return ACTIVE_STATUSES.has(currentStatus) },
    async start() {
      if (currentStatus !== 'scheduled' || operationKind !== null) return currentStatus
      currentStatus = 'running'
      try {
        await onStart?.()
      } catch (error) {
        if (operationKind === 'cancelled' || !ACTIVE_STATUSES.has(currentStatus)) return currentStatus
        currentStatus = 'failed'
        resolveFinished({ status: currentStatus, reason: 'start-failed', error })
        throw error
      }
      return currentStatus
    },
    settle(reason = 'settle') {
      return transition('settled', onSettle, reason)
    },
    cancel(reason = 'cancel') {
      return transition('cancelled', onCancel, reason)
    },
    async pause() {
      if (currentStatus !== 'running' || operationKind !== null) return currentStatus
      await onPause?.()
      if (currentStatus === 'running' && operationKind !== 'cancelled') currentStatus = 'paused'
      return currentStatus
    },
    async resume() {
      if (currentStatus !== 'paused' || operationKind !== null) return currentStatus
      await onResume?.()
      if (currentStatus === 'paused' && operationKind !== 'cancelled') currentStatus = 'running'
      return currentStatus
    },
    complete(reason = 'natural-completion') {
      return transition('settled', null, reason)
    },
  }

  return Object.freeze(handle)
}

/** Owns all performances active in the current story step. */
export class PerformanceRegistry {
  constructor() {
    this._active = new Map()
    this._completed = []
  }

  register(handle) {
    this._assertHandle(handle)
    if (this._active.has(handle.id)) {
      throw new Error(`duplicate performance id: ${handle.id}`)
    }
    this._active.set(handle.id, handle)
    handle.finished.then(result => {
      if (this._active.get(handle.id) === handle) this._active.delete(handle.id)
      this._completed.push(Object.freeze({
        id: handle.id,
        channel: handle.channel,
        ...result,
      }))
    })
    return handle
  }

  async replaceChannel(handle, reason = 'channel-replaced') {
    this._assertHandle(handle)
    const conflicting = this.getActive().filter(active => active.channel === handle.channel)
    await Promise.all(conflicting.map(active => active.cancel(reason)))
    return this.register(handle)
  }

  get(id) {
    return this._active.get(id) || null
  }

  getActive() {
    return [...this._active.values()].filter(handle => handle.active)
  }

  getCompleted() {
    return [...this._completed]
  }

  hasUnsettled() {
    return this.getActive().length > 0
  }

  hasBlockingInput() {
    return this.getActive().some(handle => handle.blocksInput)
  }

  hasBlockingAuto() {
    return this.getActive().some(handle => handle.blocksAuto)
  }

  async settleSkippable(reason = 'settle-skippable') {
    const targets = this.getActive().filter(handle => handle.skippable)
    await Promise.all(targets.map(handle => handle.settle(reason)))
    return targets.length
  }

  async cancelAll(reason = 'cancel-all') {
    const targets = this.getActive()
    await Promise.all(targets.map(handle => handle.cancel(reason)))
    return targets.length
  }

  clearCompleted() {
    this._completed = []
  }

  async dispose() {
    await this.cancelAll('registry-dispose')
    this._active.clear()
  }

  _assertHandle(handle) {
    if (!handle || typeof handle !== 'object') throw new TypeError('performance handle is required')
    for (const key of ['id', 'channel', 'settle', 'cancel']) {
      if (!handle[key]) throw new TypeError(`performance handle is missing ${key}`)
    }
    if (!handle.finished || typeof handle.finished.then !== 'function') {
      throw new TypeError('performance handle.finished must be a Promise')
    }
  }
}
