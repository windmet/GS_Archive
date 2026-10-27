import { UNIT_CODE_TO_NAME } from '../utils/UnitNameMap.js'

// The song overview's three tiers: 代表曲 (configurable formation), 组合曲 (fixed unit) and 特别编成. Lineups are
// sections of one list, not filters. Units keep the game's unit order; songs keep the order they come in.
// A song row names its unit as performance.unitName (read model) or performance_mapping.confirmed_unit (catalog JSON).
const UNIT_ORDER = Object.keys(UNIT_CODE_TO_NAME)
const CODE_BY_NAME = new Map(Object.entries(UNIT_CODE_TO_NAME).map(([code, name]) => [name, code]))

export function songUnit(song) {
  const confirmed = song?.performance_mapping?.confirmed_unit
  const name = song?.performance?.unitName || confirmed?.unit_name || ''
  const code = confirmed?.unit_code || CODE_BY_NAME.get(name) || ''
  return { code, name: name || UNIT_CODE_TO_NAME[code] || '' }
}

export function groupSongTiers(songs = [], classify = () => 'fixed_special_lineup') {
  const featured = [], special = [], byUnit = new Map()
  for (const song of songs) {
    const kind = classify(song)
    if (kind === 'configurable_formation') featured.push(song)
    else if (kind === 'fixed_unit') {
      const unit = songUnit(song)
      const key = unit.code || unit.name || song.song_code
      if (!byUnit.has(key)) { const at = UNIT_ORDER.indexOf(unit.code); byUnit.set(key, { ...unit, order: at < 0 ? Infinity : at, songs: [] }) }
      byUnit.get(key).songs.push(song)
    } else special.push(song)
  }
  const units = [...byUnit.values()].sort((a, b) => a.order - b.order)
  return { featured, units, unitSongCount: units.reduce((sum, unit) => sum + unit.songs.length, 0), special }
}
