/** Product publication choice, not a claim about copyright or source ownership. */
export const EXTERNAL_STORY_RESOURCES_ENABLED = false
const REGISTRY = 'data/external_story_resources.json'

export function isWithdrawnExternalStoryKey(key) {
  if (EXTERNAL_STORY_RESOURCES_ENABLED || typeof key !== 'string') return false
  return key === REGISTRY || /^versions\/[a-f0-9]{64}\/data\/external_story_resources\.json$/.test(key)
}
