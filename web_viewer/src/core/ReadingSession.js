/** Navigation owns validity; this feature only publishes one atomic reading state. */
export function createReadingSession({ repository, publish }) {
  return {
    async open(documentId, intent) {
      if (!intent.isCurrent()) return
      publish({ status: 'loading', document: null, entries: [], error: '' })
      let entries = []
      try {
        entries = (await repository.manifest()).entries
        if (!intent.isCurrent()) return
        const result = await repository.load(documentId)
        if (intent.isCurrent()) publish({ ...result, entries, error: '' })
      } catch (error) {
        if (intent.isCurrent()) publish({ status: 'error', document: null, entries, error: error.message })
      }
    },
  }
}
