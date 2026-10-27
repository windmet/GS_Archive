// The 事务所 console's idol list: every idol, grouped by unit in the roster's own order, searchable by the full name
// the reader sees, the kana, or the unit. A search that matches a unit's name keeps the whole unit.
export function groupConsoleIdols(idols = [], label = idol => idol.name, query = '') {
  const needle = String(query || '').trim().toLowerCase()
  const groups = []
  const byUnit = new Map()
  for (const idol of idols) {
    const unit = idol.unitName || '315 STARS'
    const haystack = [label(idol), idol.name, idol.kana, unit].filter(Boolean).join(' ').toLowerCase()
    const unitMatches = needle && unit.toLowerCase().includes(needle)
    if (needle && !unitMatches && !haystack.includes(needle)) continue
    if (!byUnit.has(unit)) { const group = { unit, idols: [] }; byUnit.set(unit, group); groups.push(group) }
    byUnit.get(unit).idols.push(idol)
  }
  return groups
}
