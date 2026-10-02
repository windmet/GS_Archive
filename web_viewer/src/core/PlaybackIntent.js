/** Tokens authorize commits, never keep a resource payload alive. */
export function createPlaybackIntent(identity = () => '') {
  let generation = 0, disposed = false, controller = null
  function cancel() { generation++; controller?.abort(); controller = null }
  function begin() {
    cancel()
    const revision = generation, owner = new AbortController(), key = identity()
    controller = owner
    return { signal: owner.signal, current: () => !disposed && !owner.signal.aborted &&
      revision === generation && key === identity() }
  }
  return { begin, cancel, revision: () => generation,
    dispose() { disposed = true; cancel() }, inspect: () => ({ generation, disposed }) }
}
