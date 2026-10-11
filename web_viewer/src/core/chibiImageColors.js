import { addressedTintsAt } from './chibiBodyColors.js'

export function imageColorsAt(events = [], time = 0) {
  return addressedTintsAt(events, time, 'asset', value => typeof value === 'string' && value.length > 0)
}

// A flattened alpha composite can be tinted exactly only when every component
// has the same tint. Never average independently addressed authored layers.
export function compositeImageTint(layers = [], colors = new Map()) {
  if (!layers.length) return { color: 0xffffff, uniform: colors.size === 0, layers: [] }
  const entries = layers.map(asset => ({ asset, color: colors.get(asset) ?? 0xffffff }))
  const uniform = entries.every(entry => entry.color === entries[0].color)
  return { color: uniform ? entries[0].color : 0xffffff, uniform, layers: entries }
}
