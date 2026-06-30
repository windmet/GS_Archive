import { groupFileCount } from './IndexNormalizer.js'

export function countScenarioFiles(categories = []) {
  let sum = 0
  for (const cat of categories || []) {
    if (cat.groups) sum += cat.groups.reduce((s, g) => s + groupFileCount(g), 0)
    if (cat.characters) {
      for (const ch of Object.values(cat.characters)) {
        sum += (ch.groups || []).reduce((s, g) => s + groupFileCount(g), 0)
      }
    }
    if (cat.individual) {
      for (const ch of Object.values(cat.individual)) {
        sum += (ch.groups || []).reduce((s, g) => s + groupFileCount(g), 0)
      }
    }
    if (cat.units) {
      for (const u of cat.units) {
        for (const ep of u.episodes || []) {
          sum += groupFileCount(ep)
        }
      }
    }
  }
  return sum
}

export function getCategoryCountText(cat) {
  if (!cat) return ''
  if (cat.id === 'idol' && cat.characters) return `${Object.keys(cat.characters).length} idols`
  if (cat.id === 'idol_chat') {
    const n = Object.keys(cat.individual || {}).length
    const g = (cat.groups || []).length
    return `${n + g} chats`
  }
  if (cat.id === 'idol_phone') {
    return `${Object.keys(cat.individual || {}).length} calls`
  }
  if (cat.units) return `${cat.units.length} units`
  if (cat.groups) {
    const c = cat.groups.reduce((s, g) => s + groupFileCount(g), 0)
    return `${c} files`
  }
  return ''
}
