/** Owns asynchronous navigation intent, not route or feature state.
 * Work may populate shared resource caches after supersession; only the current
 * intent may publish a page, loading progress, or a history update.
 */
export function createArchiveNavigationCoordinator({ onFinish = () => {} } = {}) {
  let active = null
  let disposed = false
  function begin({ restoring = false } = {}) {
    const intent = { restoring, pending: true, isCurrent: () => !disposed && active === intent }
    active = intent
    return intent
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
    isPending: () => !!active?.pending,
    isRestoring: () => !!(active?.pending && active.restoring),
    invalidate: () => { active = null },
    dispose: () => { disposed = true; active = null },
  }
}
