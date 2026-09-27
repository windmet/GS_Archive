import { getIdolMotionSettingUrl } from './AssetResolver.js'
import { createStoryConfigStore } from './StoryConfigStore.js'
const store = createStoryConfigStore({ kind: 'idol-motion', url: getIdolMotionSettingUrl, project: data => data.entries })
export const loadIdolMotionSettings = options => store.load(options)
export function getCachedMotionSetting(idolId, modelId, animName) {
  const entries = store.peek()
  return animName ? entries?.[modelId]?.[animName] || entries?.[idolId]?.[animName] || null : null
}
