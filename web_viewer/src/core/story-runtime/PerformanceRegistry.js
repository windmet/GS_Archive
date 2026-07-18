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
  let resolveFinished
  const finished = new Promise(resolve => { resolveFinished = resolve })

  async function transition(finalStatus, callback, reason) {
    if (!ACTIVE_STATUSES.has(currentStatus)) return currentStatus
    if (operation) return operation
    operation = (async () => {
      try {
        await callback?.(reason)
        currentStatus = finalStatus
      } catch (error) {
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
      if (currentStatus !== 'scheduled') return currentStatus
      await onStart?.()
      currentStatus = 'running'
      return currentStatus
    },
    settle(reason = 'settle') {
      return transition('settled', onSettle, reason)
    },
    cancel(reason = 'cancel') {
      return transition('cancelled', onCancel, reason)
    },
    async pause() {
      if (currentStatus !== 'running') return currentStatus
      await onPause?.()
      currentStatus = 'paused'
      return currentStatus
    },
    async resume() {
      if (currentStatus !== 'paused') return currentStatus
      await onResume?.()
      currentStatus = 'running'
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
