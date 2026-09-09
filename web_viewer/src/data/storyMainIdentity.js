const strings = (entry, keys) => keys.every(key => typeof entry?.[key] === 'string')
const count = value => Number.isInteger(value) && value >= 0
const source = value => value && Number.isFinite(value.table) && Number.isFinite(value.offset)
const ids = values => Array.isArray(values) && values.every(value => typeof value === 'string')

export function validateMainIdentity(identity) {
  if (!Array.isArray(identity?.collections) || !Array.isArray(identity?.logicalEntries)
    || !identity.meta || !['collectionCount', 'placeholderCollectionCount', 'chapterCount', 'logicalEntryCount',
      'resourceIdCount', 'compiledFileCount'].every(key => count(identity.meta[key]))) {
    throw new Error('storyCatalog requires named mainIdentity')
  }
  if (identity.meta.collectionCount !== identity.collections.length
    || identity.meta.logicalEntryCount !== identity.logicalEntries.length
    || identity.meta.placeholderCollectionCount !== identity.collections.filter(group => group.isPlaceholder).length) {
    throw new Error('storyCatalog main identity counts disagree')
  }
  for (const entry of identity.logicalEntries) {
    if (!strings(entry, ['id', 'masterId', 'parentId', 'title', 'resourceId', 'compiledFile'])
      || entry.domain !== 'main' || typeof entry.compiledExists !== 'boolean'
      || !Number.isFinite(entry.releaseAt) || !source(entry.source)) {
      throw new Error('storyCatalog has invalid main logical entry')
    }
  }
  for (const group of identity.collections) {
    if (!strings(group, ['id', 'masterId', 'title']) || !Number.isFinite(group.releaseAt)
      || !source(group.source) || !ids(group.chapterIds) || !Array.isArray(group.chapters)
      || group.chapterCount !== group.chapters.length || group.isPlaceholder !== (group.chapters.length === 0)
      || group.chapterIds.length !== group.chapters.length || group.chapterIds.some((id, index) => id !== group.chapters[index]?.id)
      || !count(group.logicalEntryCount) || !count(group.compiledFileCount)) {
      throw new Error('storyCatalog has invalid main collection identity')
    }
    const knownIds = new Set(identity.logicalEntries.map(entry => entry.id))
    for (const chapter of group.chapters) {
      if (!strings(chapter, ['id', 'masterId', 'label', 'title']) || !Number.isFinite(chapter.releaseAt)
        || !source(chapter.source) || !ids(chapter.logicalEntryIds)
        || chapter.logicalEntryCount !== chapter.logicalEntryIds.length || !count(chapter.compiledFileCount)
        || chapter.logicalEntryIds.some(id => !knownIds.has(id))) {
        throw new Error('storyCatalog has invalid main chapter identity')
      }
    }
  }
}
