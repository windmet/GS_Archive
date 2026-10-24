import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createSongTrackRenderer, buildSongTrackGeometry } from '../src/presentation/SongTrackPresentation.js'

const data = new URL('../public/data/', import.meta.url)
const catalog = JSON.parse(readFileSync(new URL('song_catalog.json', data)))
let charts = 0, windows = 0
for (const song of Object.values(catalog.songs)) for (const difficulty of song.gameplay.difficulties) {
  const chart = JSON.parse(readFileSync(new URL(difficulty.chart.url.replace('/data/', ''), data)))
  const render = createSongTrackRenderer(chart)
  const hold = chart.notes.find(n => n.duration > 0)
  // Reuse after a forward seek, skin/speed change, and backward seek. Include
  // the lazy SVG fallback, not just the visible WebGL mesh.
  for (const [cursor, span, skin] of [
    [0, 6000, 'Note1SpriteAtlas'],
    [hold?.tick || 0, 12000, 'Note3SpriteAtlas'],
    [chart.maxTick - 500, 2000, 'Note2SpriteAtlas'],
    [0, 6000, 'Note1SpriteAtlas'],
  ]) {
    assert.deepEqual(JSON.parse(JSON.stringify(render(Math.max(0, cursor), span, skin))),
      JSON.parse(JSON.stringify(buildSongTrackGeometry(chart, Math.max(0, cursor), span, skin))))
    windows++
  }
  charts++
}
console.log(`Prepared track renderer: ${charts} charts / ${windows} windows; seeks, skins, speed windows, meshes and SVG fallback match fresh renderers`)
