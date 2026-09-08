/** Project pipeline-owned file metadata without interpreting masterdata rows. */
export function buildScenarioMetaByFile(catalog) {
  return new Map((catalog?.fileMetadata?.entries || []).map(({ key, ...entry }) => [key, entry]))
}

export function missingExtraFileEntries(catalog) {
  return (catalog?.fileMetadata?.missingExtra || []).map(({ resourceId, title }) => ({
    file: null,
    title,
    subtitle: `${resourceId} · missing compiled`,
    resourceId,
    missing: true,
    searchText: `${title} ${resourceId}`,
  }))
}

export function validateStoryFileMetadata(metadata) {
  if (!Array.isArray(metadata?.entries) || !Array.isArray(metadata?.missingExtra)) {
    throw new Error('storyCatalog requires named fileMetadata')
  }
  const keys = new Set()
  for (const entry of metadata.entries) {
    if (!entry || typeof entry.key !== 'string' || !entry.key || keys.has(entry.key)
      || (entry.file != null && typeof entry.file !== 'string')
      || (entry.file ? entry.key !== entry.file : !entry.key.startsWith('missing:'))
      || typeof entry.exists !== 'boolean'
      || !['resourceIds', 'titles'].every(key => Array.isArray(entry[key]) && entry[key].every(value => typeof value === 'string'))
      || (entry.summary != null && (typeof entry.summary !== 'object' || Array.isArray(entry.summary)
        || !Object.values(entry.summary).every(value => Number.isInteger(value) && value >= 0)))) {
      throw new Error('storyCatalog has invalid file metadata')
    }
    keys.add(entry.key)
  }
  for (const entry of metadata.missingExtra) {
    if (!entry || typeof entry.resourceId !== 'string' || typeof entry.title !== 'string') {
      throw new Error('storyCatalog has invalid missing-extra metadata')
    }
  }
}
