let cachedMotionSettings = null
let loadingMotionSettings = null

export async function loadIdolMotionSettings() {
  if (cachedMotionSettings) return cachedMotionSettings
  if (loadingMotionSettings) return loadingMotionSettings

  loadingMotionSettings = fetch('/data/idolsetting/motion/idol_motion_index.json', {
    cache: 'no-store',
  })
    .then(res => (res.ok ? res.json() : null))
    .catch(() => null)
    .then(data => {
      cachedMotionSettings = data?.entries || {}
      return cachedMotionSettings
    })

  return loadingMotionSettings
}

export function getCachedMotionSetting(idolId, modelId, animName) {
  if (!cachedMotionSettings || !animName) return null
  return cachedMotionSettings?.[modelId]?.[animName]
    || cachedMotionSettings?.[idolId]?.[animName]
    || null
}
