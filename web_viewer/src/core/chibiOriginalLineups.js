const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const code = value => typeof value === 'string' && /^\d{3}[a-z]{3}$/.test(value)
const roster = codes => Array.isArray(codes) && codes.length > 0 && codes.length <= 5
  && codes.every(code) && new Set(codes).size === codes.length

export function validateOriginalLineups(data) {
  if (data?.schemaVersion !== 2 || data.contract !== 'native-original-lineups-v2'
    || !['masterdataSha256', 'schemaSha256', 'nativeElfSha256'].every(key => digest(data.source?.[key]))
    || data.source.unitOrderField !== 'Growing.Models.Data.IdolData:37'
    || JSON.stringify(data.source.explicitOrderFields) !== '[30,31,32,33,34]'
    || !data.songs || Array.isArray(data.songs) || typeof data.songs !== 'object'
    || !data.unitOrders || Array.isArray(data.unitOrders) || typeof data.unitOrders !== 'object') throw Error('Invalid native original lineup source')
  for (const [unit, codes] of Object.entries(data.unitOrders)) {
    if (!/^\d{2}[a-z0-9]{3}$/.test(unit) || !roster(codes)) throw Error('Invalid native selected-Unit roster')
  }
  for (const [song, row] of Object.entries(data.songs)) {
    if (!/^[a-z0-9]+$/.test(song) || !Number.isSafeInteger(row?.songId) || row.songId <= 0 || !['table46-explicit', 'table2-unit-default'].includes(row?.basis)
      || !roster(row.codes)
      || !(row.unitCode === null || /^\d{2}[a-z0-9]{3}$/.test(row.unitCode))
      || (row.basis === 'table2-unit-default' && !row.unitCode)) throw Error('Invalid native original lineup row')
    if (row.basis === 'table2-unit-default' && JSON.stringify(row.codes) !== JSON.stringify(data.unitOrders[row.unitCode]))
      throw Error('Native fixed-song / selected-Unit order mismatch')
  }
  return data
}

// The native selected-Unit edit path sorts its completed in-unit cards by
// IdolUnitSortOrder too. Read the selected unit, never the base song's roster.
export function originalMemberSelection(song, native, fallbackCodes, slotOrdered) {
  if (song?.vocalSetting?.mode === 'unit') {
    const codes = native?.unitOrders?.[song.vocalSetting.unitCode]
    if (codes) return { codes, basis: 'table2-selected-unit', slotOrdered: true, activeSubset: false, requireOrderedUnit: true }
    // A missing native Unit source must not silently claim ID-sorted members.
    return { codes: [], basis: 'unavailable-selected-unit', slotOrdered: true, activeSubset: false, requireOrderedUnit: true }
  }
  const row = !song?.vocalSetting && !song?.variant && song?.songCode !== 'drv999'
    ? native?.songs?.[song?.songCode] : null
  if (row) return { codes: row.codes, basis: row.basis, slotOrdered: true,
    activeSubset: row.basis === 'table2-unit-default' }
  return { codes: fallbackCodes, basis: slotOrdered ? 'table46-explicit' : 'idol-number-fallback',
    slotOrdered, activeSubset: false }
}
