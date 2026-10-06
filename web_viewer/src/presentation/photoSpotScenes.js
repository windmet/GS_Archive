// A photo spot owns its scenes (the time-of-day / weather variants of the place); masterdata links
// them through sceneIdsBySpotId. One reading of that structure for every place that browses spots
// (photo catalogue, studio material picker).
const indexes = new WeakMap()

function index(materials) {
  if (!materials) return null
  let value = indexes.get(materials)
  if (!value) {
    const sceneById = new Map((materials.scenes || []).map((row) => [row.id, row]))
    // A scene belongs to one spot; a scene listed under several has no single owner.
    const owners = new Map()
    for (const spot of materials.spots || []) for (const id of materials.sceneIdsBySpotId?.[spot.id] || []) owners.set(id, owners.has(id) ? null : spot)
    value = { sceneById, owners, scenesBySpot: new Map() }
    indexes.set(materials, value)
  }
  return value
}

export function photoSpotScenes(materials, spot) {
  const value = index(materials)
  if (!value || !spot) return []
  if (!value.scenesBySpot.has(spot.id))
    value.scenesBySpot.set(spot.id, (materials.sceneIdsBySpotId?.[spot.id] || []).map((id) => value.sceneById.get(id)).filter(Boolean))
  return value.scenesBySpot.get(spot.id)
}

export const photoSceneSpot = (materials, sceneId) => index(materials)?.owners.get(Number(sceneId)) || null

// "通常1"/"通常2" are both 通常 for filtering.
export const photoVariantKey = (name) => String(name || '').replace(/\d+$/, '')

export const photoSpotVariantKeys = (materials, spot) => [...new Set(photoSpotScenes(materials, spot).map((row) => photoVariantKey(row.name)))]

// Variants shared by more than one spot, most common first; `label` translates a variant key.
export function photoSpotVariants(materials, label = (id) => id) {
  const counts = new Map()
  for (const spot of materials?.spots || []) for (const key of photoSpotVariantKeys(materials, spot)) counts.set(key, (counts.get(key) || 0) + 1)
  return [...counts].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ id, count, label: label(id) || id }))
}

// The scene a spot opens on: the one for the active variant if it has one, else its first.
export function photoSpotScene(materials, spot, variant = '') {
  const scenes = photoSpotScenes(materials, spot)
  return (variant && scenes.find((row) => photoVariantKey(row.name) === variant)) || scenes[0] || null
}
