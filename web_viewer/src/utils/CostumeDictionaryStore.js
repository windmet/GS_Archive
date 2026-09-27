import { getCostumeDictionaryUrl } from './AssetResolver.js'
import { createStoryConfigStore } from './StoryConfigStore.js'
const store = createStoryConfigStore({ kind: 'costume-dictionary', url: getCostumeDictionaryUrl, project: data => data.by_model_resource_id })
export const loadCostumeDictionary = options => store.load(options)
export const getCachedCostumeInfo = modelId => store.peek()?.[modelId] || null
