/** Owns asynchronous navigation intent, not route or feature state.
 * Supersession aborts signal-aware work. Non-cancellable work may still finish;
 * only the current intent may publish a page, progress, or a history update.
 */
export function createArchiveNavigationCoordinator({ onFinish = () => {} } = {}) {
  let active = null
  let activeController = null
  let disposed = false
  let revision = 0
  function begin({ restoring = false } = {}) {
    revision++
    const previous = activeController
    activeController = new AbortController()
    const intent = { restoring, pending: true, signal: activeController.signal, isCurrent: () => !disposed && active === intent }
    active = intent
    // Revoke publication before notifying abort listeners on the old work.
    previous?.abort()
    return intent
  }
  function invalidate() {
    revision++
    active = null
    const previous = activeController
    activeController = null
    previous?.abort()
  }
  function finish(intent) {
    intent.pending = false
    if (intent.isCurrent()) onFinish()
  }
  async function run(action, { intent: inherited, restoring = false } = {}) {
    if (disposed) return
    const intent = inherited || begin({ restoring })
    if (!intent.isCurrent()) return
    try {
      return await action(intent)
    } catch (error) {
      if (intent.isCurrent()) throw error
    } finally {
      if (!inherited) finish(intent)
    }
  }
  return {
    run,
    isDisposed: () => disposed,
    getRevision: () => revision,
    isPending: () => !!active?.pending,
    isRestoring: () => !!(active?.pending && active.restoring),
    invalidate,
    dispose: () => { disposed = true; invalidate() },
  }
}
