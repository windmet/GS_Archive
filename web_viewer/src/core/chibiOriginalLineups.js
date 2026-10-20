const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const code = value => typeof value === 'string' && /^\d{3}[a-z]{3}$/.test(value)

export function validateOriginalLineups(data) {
  if (data?.schemaVersion !== 1 || data.contract !== 'native-fixed-original-lineups-v1'
    || !['masterdataSha256', 'schemaSha256', 'nativeElfSha256'].every(key => digest(data.source?.[key]))
    || data.source.unitOrderField !== 'Growing.Models.Data.IdolData:37'
    || JSON.stringify(data.source.explicitOrderFields) !== '[30,31,32,33,34]'
    || !data.songs || Array.isArray(data.songs) || typeof data.songs !== 'object') throw Error('Invalid native original lineup source')
  for (const [song, row] of Object.entries(data.songs)) {
    if (!/^[a-z0-9]+$/.test(song) || !Number.isSafeInteger(row?.songId) || row.songId <= 0 || !['table46-explicit', 'table2-unit-default'].includes(row?.basis)
      || !Array.isArray(row.codes) || !row.codes.length || row.codes.length > 5
      || row.codes.some(value => !code(value)) || new Set(row.codes).size !== row.codes.length
      || !(row.unitCode === null || /^\d{2}[a-z0-9]{3}$/.test(row.unitCode))
      || (row.basis === 'table2-unit-default' && !row.unitCode)) throw Error('Invalid native original lineup row')
  }
  return data
}

// Unit/center vocal variants have a separate native deck-edit path. A base
// song's fixed original roster must never override the selected vocal variant.
export function originalMemberSelection(song, native, fallbackCodes, slotOrdered) {
  const row = !song?.vocalSetting && !song?.variant && song?.songCode !== 'drv999'
    ? native?.songs?.[song?.songCode] : null
  if (row) return { codes: row.codes, basis: row.basis, slotOrdered: true,
    activeSubset: row.basis === 'table2-unit-default' }
  return { codes: fallbackCodes, basis: slotOrdered ? 'table46-explicit' : 'idol-number-fallback',
    slotOrdered, activeSubset: false }
}
