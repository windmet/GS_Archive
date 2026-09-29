import { getCostumePrefabMetaUrl } from './AssetResolver.js'
import { createStoryConfigStore } from './StoryConfigStore.js'
const store = createStoryConfigStore({ kind: 'costume-prefab-metadata', url: getCostumePrefabMetaUrl, project: data => data.models })
export const loadCostumePrefabMeta = options => store.load(options)
export async function getCostumePrefabMeta(modelId, options) {
  return (await store.load(options))?.[modelId] || null
}
export const getCachedCostumePrefabMeta = modelId => store.peek()?.[modelId] || null
