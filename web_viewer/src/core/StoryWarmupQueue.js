import { waitForSignal } from './AsyncLoadBoundary.js'
/** A live, bounded speculation window. Idle is not disposed: later steps may wake it.
 * This queue never owns renderer readiness or navigation publication. */
export class StoryWarmupQueue {
  constructor({ tasks, run, eligible, priority, report = () => {}, signal,
    concurrency = 2, imageConcurrency = 1 }) {
    Object.assign(this, { tasks, run, eligible, priority, report, concurrency, imageConcurrency })
    this.active = new Map()
    this.started = false
    this.paused = false
    this.disposed = false
    this.waiters = []
    this.signal = signal
    this.abort = () => this.dispose()
    signal?.addEventListener('abort', this.abort, { once: true })
  }
  start() {
    this.started = true
    if (!this.drain) this.drain = new Promise(resolve => this.waiters.push(resolve))
    const promise = this.drain
    this.pump()
    return promise
  }
  setPaused(paused) {
    this.paused = Boolean(paused)
    this.update()
  }
  update() {
    // Release speculation that has left the window. Keep an in-flight resource
    // promoted to current so the shared byte transport can hand it to the renderer.
    for (const [task, owner] of this.active) {
      if ((this.paused && this.priority(task) !== 'critical') || this.priority(task) === 'deferred') {
        owner.abort(Object.assign(new Error('Speculation yielded to current view'), { code: 'WARMUP_YIELD' }))
      }
    }
    this.pump()
  }
  isImage(task) { return task.operation === 'image' || task.operation === 'spine-page' }
  pump() {
    if (this.disposed || !this.started || this.paused) return this.settleIdle()
    const pending = this.tasks.filter(task => task.state === 'discovered' && !this.active.has(task) && this.eligible(task))
      .sort((a, b) => (this.priority(a) === 'critical' ? 0 : 1) - (this.priority(b) === 'critical' ? 0 : 1))
    while (this.active.size < this.concurrency) {
      const images = [...this.active.keys()].filter(task => this.isImage(task)).length
      const index = pending.findIndex(task => !this.isImage(task) || images < this.imageConcurrency)
      if (index < 0) break
      const task = pending.splice(index, 1)[0]
      const owner = new AbortController()
      this.active.set(task, owner)
      task.state = 'loading'
      Promise.resolve().then(() => {
        owner.signal.throwIfAborted()
        return waitForSignal(this.run(task, owner.signal), owner.signal)
      }).catch(error => {
        // Adapter owns settled errors. A pre-dispatch yield owns only queue state.
        if (error?.code === 'WARMUP_YIELD') task.state = 'discovered'
        else if (this.disposed) task.state = 'cancelled'
        else { task.state = 'failed'; task.error = String(error?.message || error) }
      }).finally(() => {
        this.active.delete(task)
        if (!this.disposed) this.report()
        this.pump()
      })
    }
    this.settleIdle()
  }
  settleIdle() {
    if (this.active.size) return
    if (this.drain) {
      const waiters = this.waiters.splice(0)
      this.drain = null
      for (const resolve of waiters) resolve()
    }
  }
  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.signal?.removeEventListener('abort', this.abort)
    for (const owner of this.active.values()) owner.abort(new DOMException('Warmup disposed', 'AbortError'))
    this.settleIdle()
  }
}
