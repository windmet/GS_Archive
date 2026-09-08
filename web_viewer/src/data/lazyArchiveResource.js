/** Page-owned lazy publication; transport/cache ownership remains in the repository. */
export function createLazyArchiveResource({ read, load, publish, onError, isDisposed = () => false }) {
  let pending = null
  return async function ensure() {
    if (isDisposed()) return null
    const current = read()
    if (current) return current
    if (!pending) {
      pending = Promise.resolve().then(load).then(data => {
        if (isDisposed()) return null
        publish(data)
        return data
      }).catch(error => {
        if (!isDisposed()) onError?.(error)
        return null
      }).finally(() => { pending = null })
    }
    return pending
  }
}
