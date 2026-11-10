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

// "通常1"/"通常2" are both 通常 for filtering. 昼 (mostly indoor sets) and 日中 both mean daytime and read 白天, so they
// filter as one chip.
const VARIANT_ALIASES = { 昼: '日中' }
export const photoVariantKey = (name) => { const key = String(name || '').replace(/\d+$/, ''); return VARIANT_ALIASES[key] || key }

export const photoSpotVariantKeys = (materials, spot) => [...new Set(photoSpotScenes(materials, spot).map((row) => photoVariantKey(row.name)))]

// Variants shared by more than one item, most common first; `label` translates a variant key.
// Every picker that filters backgrounds by time of day ranks its chips through this.
export function rankPhotoVariants(keyLists, label = (id) => id) {
  const counts = new Map()
  for (const keys of keyLists) for (const key of new Set(keys)) counts.set(key, (counts.get(key) || 0) + 1)
  return [...counts].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ id, count, label: label(id) || id }))
}

export const photoSpotVariants = (materials, label) =>
  rankPhotoVariants((materials?.spots || []).map((spot) => photoSpotVariantKeys(materials, spot)), label)

// Raw scene variants ("通常1", "夜") to the keys chips filter by.
export const photoVariantKeys = (variants = []) => [...new Set(variants.map(photoVariantKey))]

// A spot can carry two scenes of the same shown name (アリーナ客席 has 昼 and 日中, both 白天); number the repeats so
// every scene button in a spot reads differently. Returns Map(scene.id -> label).
export function photoSceneLabels(scenes = [], nameOf = (scene) => scene.name) {
  const seen = new Map()
  return new Map(scenes.map((scene) => {
    const base = nameOf(scene), count = (seen.get(base) || 0) + 1
    seen.set(base, count)
    return [scene.id, count > 1 ? `${base} ${count}` : base]
  }))
}

// The scene a spot opens on: the one for the active variant if it has one, else its first.
export function photoSpotScene(materials, spot, variant = '') {
  const scenes = photoSpotScenes(materials, spot)
  return (variant && scenes.find((row) => photoVariantKey(row.name) === variant)) || scenes[0] || null
}

// The game ships a 300×160 thumbnail for every background (image_bg_s/<name>_s.png, deployed under
// /assets/bg/thumbs/). Grids show those; a background picked for the canvas or a detail view still
// loads the full picture. Callers fall back to the full URL if a thumbnail fails to load.
export function photoBackgroundThumbnailUrl(url) {
  const match = /^\/assets\/bg\/([^/]+)\.png$/.exec(String(url || ''))
  return match ? `/assets/bg/thumbs/${match[1]}_s.png` : url || ''
}
