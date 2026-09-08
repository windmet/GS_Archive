/** Owns asynchronous navigation intent, not route or feature state.
 * Work may populate shared resource caches after supersession; only the current
 * intent may publish a page, loading progress, or a history update.
 */
export function createArchiveNavigationCoordinator({ onFinish = () => {} } = {}) {
  let active = null
  let disposed = false
  let revision = 0
  function begin({ restoring = false } = {}) {
    revision++
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
    getRevision: () => revision,
    isPending: () => !!active?.pending,
    isRestoring: () => !!(active?.pending && active.restoring),
    invalidate: () => { revision++; active = null },
    dispose: () => { revision++; disposed = true; active = null },
  }
}
