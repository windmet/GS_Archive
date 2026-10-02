/** Navigation owns validity; this feature only publishes one atomic reading state. */
export function createReadingSession({ repository, publish }) {
  return {
    async open(documentId, intent, knownLocator = null) {
      if (!intent.isCurrent()) return
      let entries = knownLocator?.entries || []
      const cached = knownLocator && repository.peek?.(documentId, knownLocator.entry)
      if (cached) { publish({...cached,entries,error:''}); return }
      publish({ status: 'loading', document: null, entries, error: '' })
      try {
        const locator = knownLocator || (repository.locator ? await repository.locator(documentId) : null)
        entries = locator?.entries || (await repository.manifest()).entries
        if (!intent.isCurrent()) return
        const result = await repository.load(documentId, locator?.entry)
        if (intent.isCurrent()) publish({ ...result, entries, error: '' })
      } catch (error) {
        if (intent.isCurrent()) publish({ status: 'error', document: null, entries, error: error.message })
      }
    },
  }
}

export function knownReadingLocator(detail, documentId) {
  const entries = detail?.view?.readingEntries || []
  const selected = entries.filter(entry => entry.document_id === documentId)
  return selected.length === 1 ? {entry:selected[0],entries:entries.filter(entry => entry.logical_id === selected[0].logical_id)} : null
}
