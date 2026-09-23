const strings = (value, keys) => keys.every(key => typeof value?.[key] === 'string')
const date = value => value === null || Number.isFinite(value)

function validateEpisodes(episodes) {
  if (!Array.isArray(episodes)) throw new Error('storyCatalog requires named episodes')
  for (const episode of episodes) {
    if (!strings(episode, ['id', 'label', 'resourceId', 'part']) || !/^[a-z]?$/i.test(episode.part)) {
      throw new Error('storyCatalog has invalid episode structure')
    }
  }
}

export function validateEventEpisodeStructure(structure) {
  if (!Array.isArray(structure)) throw new Error('storyCatalog requires eventEpisodeStructure')
  const groupIds = new Set()
  for (const group of structure) {
    if (typeof group?.groupId !== 'string' || groupIds.has(group.groupId)) {
      throw new Error('storyCatalog has invalid event group identity')
    }
    groupIds.add(group.groupId)
    validateEpisodes(group.episodes)
  }
}

/** Validate pipeline relationship names before any collection is presented. */
export function validateStoryCollectionStructure(structure) {
  if (!Array.isArray(structure)) throw new Error('storyCatalog requires collectionStructure')
  for (const group of structure) {
    if (!['main', 'unit_story'].includes(group?.domain)
      || !strings(group, ['sectionId', 'title', 'assetCode']) || !date(group.releaseAt)
      || !Array.isArray(group.chapters)) {
      throw new Error('storyCatalog has invalid collection structure')
    }
    for (const chapter of group.chapters) {
      if (!strings(chapter, ['id', 'label', 'title', 'backgroundId', 'file'])
        || !date(chapter.releaseAt) || !Array.isArray(chapter.episodes)) {
        throw new Error('storyCatalog has invalid chapter structure')
      }
      validateEpisodes(chapter.episodes)
    }
  }
}
