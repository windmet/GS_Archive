// Idol honors (HonorData type 2) carry their idol in the id: 2 XX YY 001, where XX is the idol
// number (the first three digits of the idol code, 001tom = 1 … 049eis = 49) and YY the kind.
// All 122 type-2 honors decode; every 担当 name matches its idol, and the user-reported bond records
// (public/data/editorial/honor-bonds.json) name the same idol for all 98 they cover.
const KINDS = { 15: 'tantou', 22: 'catchphrase', 27: 'fes-change', 28: 'fes-limitbreak' }
const ORDER = ['tantou', 'catchphrase', 'fes-change', 'fes-limitbreak']

export function idolHonorIdentity(entry) {
  if (Number(entry?.honorType) !== 2) return null
  const match = String(entry.id).match(/^2(\d{2})(\d{2})\d{3}$/)
  const kind = match && KINDS[Number(match[2])]
  return kind ? { idolNumber: Number(match[1]), kind } : null
}

export function idolHonorBelongsTo(entry, idolCode) {
  const identity = idolHonorIdentity(entry)
  return Boolean(identity) && identity.idolNumber === Number(String(idolCode || '').slice(0, 3))
}

export const idolHonorOrder = kind => ORDER.indexOf(kind)

// FES achievement names are internal labels ("22/12FES限定フォトをチェンジさせる_伊集院 北斗");
// the leading year/month names the FES they belong to.
export function fesHonorMonth(entry) {
  const match = String(entry?.nameJa || '').match(/^(\d{2})\/(\d{1,2})FES/)
  return match ? `20${match[1]}年${Number(match[2])}月` : ''
}

// VDCP (Valentine) chocolate honors (HonorData type 3) carry no ranking configuration; their idol and
// tier sit in the id: base + (idol number − 1) × 5 + tier, tier 0–4 = 100 / 500 / 1000 / 5000 / 8000
// chocolates. Each season is the same Valentine event as that year's VDCP ranking honors.
const CHOCOLATE_SEASONS = [
  { year: 2022, base: 30024001, eventId: 40001 },
  { year: 2023, base: 30024246, eventId: 40002 },
]
const CHOCOLATE_COUNTS = [100, 500, 1000, 5000, 8000]
const CHOCOLATE_IDOLS = 49

export function chocolateHonorIdentity(entry) {
  if (Number(entry?.honorType) !== 3) return null
  const id = Number(entry.id)
  const season = CHOCOLATE_SEASONS.find(row => id >= row.base && id < row.base + CHOCOLATE_IDOLS * CHOCOLATE_COUNTS.length)
  if (!season) return null
  const offset = id - season.base
  return {
    idolNumber: Math.floor(offset / CHOCOLATE_COUNTS.length) + 1,
    year: season.year,
    eventId: season.eventId,
    count: CHOCOLATE_COUNTS[offset % CHOCOLATE_COUNTS.length],
  }
}

export function chocolateHonorBelongsTo(entry, idolCode) {
  const identity = chocolateHonorIdentity(entry)
  return Boolean(identity) && identity.idolNumber === Number(String(idolCode || '').slice(0, 3))
}
