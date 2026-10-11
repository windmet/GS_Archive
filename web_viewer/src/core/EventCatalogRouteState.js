const EVENT_KINDS = new Set(['theater', 'collection', 'tour', 'valentine', 'whiteday'])

export function normalizeEventBrowseState(input = {}) {
  input = input || {}
  const page = Number(input.page)
  return {
    kind: EVENT_KINDS.has(input.kind) ? input.kind : '',
    sort: input.sort === 'oldest' ? 'oldest' : 'newest',
    page: Number.isInteger(page) && page >= 0 ? Math.min(10000, page) : 0,
  }
}
