const strings = (value, keys) => keys.every(key => typeof value?.[key] === 'string')
const domains = new Set(['main', 'event', 'unit_story', 'idol_story', 'card_scenarios', 'work', 'birthday', 'extra'])

export function validateBirthdayIdentity(identity) {
  if (!Array.isArray(identity?.logicalEntries)) throw new Error('storyCatalog requires named birthdayIdentity')
  for (const entry of identity.logicalEntries) {
    if (!strings(entry, ['id', 'masterId', 'parentId', 'title', 'resourceId', 'compiledFile'])
      || entry.domain !== 'birthday' || !Number.isFinite(entry.releaseAt)
      || typeof entry.compiledExists !== 'boolean' || !Number.isFinite(entry.source?.table) || !Number.isFinite(entry.source?.offset)
      || !Array.isArray(entry.domainMemberships) || entry.domainMemberships.some(domain => !domains.has(domain))
      || (entry.birthdaySemantics != null && (typeof entry.birthdaySemantics !== 'object' || Array.isArray(entry.birthdaySemantics)))) {
      throw new Error('storyCatalog has invalid birthday logical entry')
    }
  }
}
