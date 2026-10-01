import { STUDIO_LIMITS } from './StudioDocument.mjs'

export function removeStudioLayer(document, id) {
  const kind = ['actors', 'stickers'].find(key => document[key].some(row => row.instanceId === id))
  if (!kind) return null
  const index = document[kind].findIndex(row => row.instanceId === id)
  const row = JSON.parse(JSON.stringify(document[kind][index]))
  document[kind].splice(index, 1)
  return { document, kind, index, row }
}

export function canRestoreStudioLayer(document, removal) {
  return Boolean(removal && removal.document === document &&
    document[removal.kind].length < STUDIO_LIMITS[removal.kind] &&
    ![...document.actors, ...document.stickers].some(row => row.instanceId === removal.row.instanceId))
}

export function restoreStudioLayer(document, removal) {
  if (!canRestoreStudioLayer(document, removal)) return false
  document[removal.kind].splice(Math.min(removal.index, document[removal.kind].length), 0, removal.row)
  return true
}
