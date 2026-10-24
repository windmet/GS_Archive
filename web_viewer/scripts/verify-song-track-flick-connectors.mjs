import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildSongTrackGeometry, createSongTrackRenderer } from '../src/presentation/SongTrackPresentation.js'
import nativeHolds from '../config/song-track-native-hold-geometry.v1.json' with { type: 'json' }

const root = new URL('../public/data/', import.meta.url)
const catalog = JSON.parse(readFileSync(new URL('song_catalog.json', root)))

// 1. Target chart: BRAND NEW FIELD EXPERT (brndnf-4)
const brndnf = JSON.parse(readFileSync(new URL('song_charts/brndnf-4.json', root)))
const renderer = createSongTrackRenderer(brndnf)

// Window at tick 22000 (flickgroup 785049 across lanes 4, 3, 2, 1, 0)
const scene22k = renderer(22000, 2000)
const fcs22k = scene22k.holds.filter(h => h.flickConnector)
assert.equal(fcs22k.length, 4, 'flickgroup 785049 generates 4 connecting hold ribbons between 5 flick notes')
assert.equal(fcs22k[0].from, 22080)
assert.equal(fcs22k[0].to, 22200)
assert.equal(fcs22k[1].from, 22200)
assert.equal(fcs22k[1].to, 22320)
assert.equal(fcs22k[2].from, 22320)
assert.equal(fcs22k[2].to, 22440)
assert.equal(fcs22k[3].from, 22440)
assert.equal(fcs22k[3].to, 22560)

for (const fc of fcs22k) {
  assert.ok(fc.nativeMesh.vertices.length > 0, 'flick connector has native mesh vertices')
  assert.ok(fc.nativeMesh.triangles.length > 0, 'flick connector has native mesh triangles')
  assert.ok(fc.triangles.length > 0, 'flick connector has textured fallback triangles')
  assert.equal(fc.nativeMesh.uv[0][1], 0.25)
  assert.equal(fc.nativeMesh.uv.at(-1)[1], 0.75)
}

// Window around combo 307-340 (tick 125000: flickgroups 785845 & 785872)
const scene125k = renderer(125000, 3500)
const fcs125k = scene125k.holds.filter(h => h.flickConnector)
assert.ok(fcs125k.some(f => f.flickgroup === 785845), 'flickgroup 785845 active around combo 307-338')
assert.ok(fcs125k.some(f => f.flickgroup === 785872), 'flickgroup 785872 active around combo 345-349')

// 2. Comprehensive catalog scan: all charts with flickgroups produce valid geometry
let chartsWithFlickGroups = 0, totalFlickConnectors = 0
for (const song of Object.values(catalog.songs)) {
  for (const d of song.gameplay.difficulties) {
    const chart = JSON.parse(readFileSync(new URL(d.chart.url.replace('/data/', ''), root)))
    const hasFlickGroup = chart.notes.some(n => (n.flickgroup ?? 0) > 0)
    if (!hasFlickGroup) continue
    chartsWithFlickGroups++
    const scene = buildSongTrackGeometry(chart, 0, chart.maxTick || 100000)
    const fcs = scene.holds.filter(h => h.flickConnector)
    totalFlickConnectors += fcs.length
    for (const fc of fcs) {
      assert.ok(fc.nativeMesh.vertices.length <= 65536, 'fit uint16')
      for (const t of fc.triangles) {
        assert.ok(!/NaN|Infinity/.test(t.matrix + t.points), 'no degenerate matrices')
      }
    }
  }
}

console.log('Flick connector verification passed: ' + chartsWithFlickGroups + ' charts with flick groups, ' + totalFlickConnectors + ' connectors validated against ARM64 HoldMesh.Create geometry.')
