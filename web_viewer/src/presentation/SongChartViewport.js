export const CHART_TILE_HEIGHT = 768
// Keep the full scroll extent, while only mounting nearby, bounded SVG surfaces.
export function chartTileWindow(height, top, viewportHeight, overscan = CHART_TILE_HEIGHT) {
  const first = Math.max(0, Math.floor((top - overscan) / CHART_TILE_HEIGHT))
  const last = Math.min(Math.ceil(height / CHART_TILE_HEIGHT), Math.ceil((top + viewportHeight + overscan) / CHART_TILE_HEIGHT))
  return Array.from({ length: Math.max(0, last - first) }, (_, i) => {
    const from = (first + i) * CHART_TILE_HEIGHT
    return { id: first + i, from, height: Math.min(CHART_TILE_HEIGHT, height - from) }
  })
}
export function chartColumnWindow(count, left, width, columnWidth) {
  const first = Math.max(0, Math.floor(left / columnWidth) - 1)
  const last = Math.min(count, Math.ceil((left + width) / columnWidth) + 1)
  return Array.from({ length: Math.max(0, last - first) }, (_, i) => first + i)
}
export function chartGeometryWindow(geometry, from, to) {
  // Overlap includes glyphs and holds crossing a tile/column boundary.
  const inside = y => y >= from - 24 && y <= to + 24
  return {
    ...geometry,
    grid: geometry.grid.filter(n => inside(n.y)),
    tempos: geometry.tempos.filter(n => inside(n.y)),
    links: geometry.links.filter(n => inside(n.y)),
    middleNodes: geometry.middleNodes.filter(n => inside(n.y)),
    notes: geometry.notes.filter(n => n.endY >= from - 24 && n.y <= to + 24),
  }
}
