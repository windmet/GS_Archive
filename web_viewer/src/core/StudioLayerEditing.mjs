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

/** Move within the actual renderer group; the visible list is front-to-back. */
export function reorderStudioLayer(document, id, targetId) {
  const kind = ['actors', 'stickers'].find(key => document[key].some(row => row.instanceId === id))
  if (!kind || id === targetId) return false
  const rows = document[kind], from = rows.findIndex(row => row.instanceId === id), to = rows.findIndex(row => row.instanceId === targetId)
  if (to < 0) return false
  const [row] = rows.splice(from, 1)
  rows.splice(to, 0, row)
  return true
}

/** Clone an actor or sticker layer right above the source with a small horizontal offset. */
export function duplicateStudioLayer(document, id, newInstanceId) {
  const kind = ['actors', 'stickers'].find(key => document[key].some(row => row.instanceId === id))
  if (!kind || document[kind].length >= STUDIO_LIMITS[kind]) return null
  if (typeof newInstanceId !== 'string' || !/^[-a-z0-9]{1,80}$/i.test(newInstanceId)) return null
  if ([...document.actors, ...document.stickers].some(row => row.instanceId === newInstanceId)) return null
  const rows = document[kind]
  const index = rows.findIndex(row => row.instanceId === id)
  const copy = JSON.parse(JSON.stringify(rows[index]))
  delete copy.locked
  delete copy.hidden
  copy.instanceId = newInstanceId
  copy.x = copy.x <= 0.84 ? Number((copy.x + 0.06).toFixed(4)) : Number((copy.x - 0.06).toFixed(4))
  rows.splice(index + 1, 0, copy)
  return copy
}

export function centerStudioLayer(row) {
  if (!row || row.locked) return false
  row.x = 0.5
  if (!row.idolId) row.y = 0.5
  return true
}

export function resetStudioLayerRotation(row) {
  if (!row || row.locked) return false
  row.rotation = 0
  return true
}
