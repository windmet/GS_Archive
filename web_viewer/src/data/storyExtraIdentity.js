const strings = (value, keys) => keys.every(key => typeof value?.[key] === 'string')
const source = value => value && Number.isFinite(value.table) && Number.isFinite(value.offset)

export function validateExtraIdentity(identity) {
  if (!Array.isArray(identity?.groups) || !Array.isArray(identity?.logicalEntries)) {
    throw new Error('storyCatalog requires named extraIdentity')
  }
  for (const group of identity.groups) {
    if (!strings(group, ['masterId', 'seriesId', 'title']) || !source(group.source)) {
      throw new Error('storyCatalog has invalid extra group identity')
    }
  }
  for (const entry of identity.logicalEntries) {
    if (!strings(entry, ['id', 'masterId', 'parentId', 'title', 'resourceId', 'compiledFile', 'masterGroupTitle', 'seriesId'])
      || entry.domain !== 'extra' || !Number.isFinite(entry.releaseAt)
      || typeof entry.compiledExists !== 'boolean' || !source(entry.source)) {
      throw new Error('storyCatalog has invalid extra logical entry')
    }
  }
}
