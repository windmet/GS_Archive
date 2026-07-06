let cachedPrefabMeta = null
let loadingPrefabMeta = null

export async function loadCostumePrefabMeta() {
  if (cachedPrefabMeta) return cachedPrefabMeta
  if (loadingPrefabMeta) return loadingPrefabMeta

  loadingPrefabMeta = fetch('/data/idolsetting/costume_prefab_meta.json', {
    cache: 'no-store',
  })
    .then(res => (res.ok ? res.json() : null))
    .catch(() => null)
    .then(data => {
      cachedPrefabMeta = data?.models || {}
      return cachedPrefabMeta
    })

  return loadingPrefabMeta
}

export async function getCostumePrefabMeta(modelId) {
  const models = await loadCostumePrefabMeta()
  return models?.[modelId] || null
}

export function getCachedCostumePrefabMeta(modelId) {
  return cachedPrefabMeta?.[modelId] || null
}
