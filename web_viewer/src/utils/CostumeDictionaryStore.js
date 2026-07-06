let cachedCostumeDictionary = null
let loadingCostumeDictionary = null

export async function loadCostumeDictionary() {
  if (cachedCostumeDictionary) return cachedCostumeDictionary
  if (loadingCostumeDictionary) return loadingCostumeDictionary

  loadingCostumeDictionary = fetch('/data/masterdata/costume_dictionary.json', {
    cache: 'no-store',
  })
    .then(res => (res.ok ? res.json() : null))
    .catch(() => null)
    .then(data => {
      cachedCostumeDictionary = data?.by_model_resource_id || {}
      return cachedCostumeDictionary
    })

  return loadingCostumeDictionary
}

export function getCachedCostumeInfo(modelId) {
  return cachedCostumeDictionary?.[modelId] || null
}
