import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildSongTrackGeometry, createSongTrackRenderer } from '../src/presentation/SongTrackPresentation.js'
import nativeHolds from '../config/song-track-native-hold-geometry.v1.json' with { type: 'json' }
import { compileSongFlickConnectors } from '../src/presentation/SongTrackFlickConnectors.js'
import projection from '../config/song-hit-projection.v1.json' with { type: 'json' }
import nativeGeometry from '../config/song-track-native-geometry.v1.json' with { type: 'json' }
import nativeNotes from '../config/song-track-native-note-geometry.v1.json' with { type: 'json' }
import { buildNativeSongHoldMesh } from '../src/presentation/SongTrackNativeHoldGeometry.js'

const root = new URL('../public/data/', import.meta.url)
const catalog = JSON.parse(readFileSync(new URL('song_catalog.json', root)))

// 1. Target chart: BRAND NEW FIELD EXPERT (brndnf-4)
const brndnf = JSON.parse(readFileSync(new URL('song_charts/brndnf-4.json', root)))
const renderer = createSongTrackRenderer(brndnf)
assert.equal(projection.connectorRadius,nativeHolds.metrics.radius,'flick radius is the same native 64-20=44')
const chartWith = notes => ({notes})
const base = {flickgroup:1,speed:1,duration:0}
assert.equal(compileSongFlickConnectors(chartWith([
  {...base,type:'HOLD',tick:0,duration:100,start:0,end:1,endtype:'END_NORMAL'},
  {...base,type:'HOLD',tick:120,duration:100,start:3,end:4,endtype:'END_NORMAL'},
])).length,0,'ordinary holds sharing a group must not acquire flick connectors')
const tail = compileSongFlickConnectors(chartWith([
  {...base,sourceIndex:1,type:'VARIABLE_HOLD',tick:0,duration:100,start:0,end:1,endtype:'END_FLICK_RIGHT',poly:[{subtick:100,posx:2}]},
  {...base,sourceIndex:2,type:'FLICK_RIGHT',tick:120,start:3,end:3},
]))[0]
assert.deepEqual([tail.fromTick,tail.toTick,tail.fromLane,tail.toLane],[100,120,2,3],'hold connector starts at its flick tail and poly lane, not the head')

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
  const points=[...fc.samples].reverse().map(p=>({x:p.lane,y:-p.fraction*nativeHolds.metrics.timeFactor}))
  assert.deepEqual(fc.nativeMesh,buildNativeSongHoldMesh(points,nativeGeometry.target,nativeHolds.metrics,nativeNotes.defaultDrawScale),'consumer uses native 44 radius; rejects old 24-radius branch')
  assert.equal(fc.nativeMesh.uv[0][1], 0.25)
  assert.equal(fc.nativeMesh.uv.at(-1)[1], 0.75)
}

// Late-song left/right chains (tick 125000; do not infer recorded combo numbers).
const scene125k = renderer(125000, 3500)
const fcs125k = scene125k.holds.filter(h => h.flickConnector)
assert.ok(fcs125k.some(f => f.flickgroup === 785845), 'left chain 785845 present')
assert.ok(fcs125k.some(f => f.flickgroup === 785872), 'right chain 785872 present')

// 2. Comprehensive catalog scan: all charts with flickgroups produce valid geometry
let chartsWithFlickGroups = 0, chartsWithConnectors = 0, totalFlickConnectors = 0
for (const song of Object.values(catalog.songs)) {
  for (const d of song.gameplay.difficulties) {
    const chart = JSON.parse(readFileSync(new URL(d.chart.url.replace('/data/', ''), root)))
    const hasFlickGroup = chart.notes.some(n => (n.flickgroup ?? 0) > 0)
    if (!hasFlickGroup) continue
    chartsWithFlickGroups++
    const scene = buildSongTrackGeometry(chart, 0, chart.maxTick || 100000)
    const fcs = scene.holds.filter(h => h.flickConnector)
    if(fcs.length)chartsWithConnectors++
    totalFlickConnectors += fcs.length
    for (const fc of fcs) {
      assert.ok(fc.nativeMesh.vertices.length <= 65536, 'fit uint16')
      for (const t of fc.triangles) {
        assert.ok(!/NaN|Infinity/.test(t.matrix + t.points), 'no degenerate matrices')
      }
    }
  }
}

console.log(`Flick connector verification passed: ${chartsWithFlickGroups} charts with raw groups, ${chartsWithConnectors} with actual connectors, ${totalFlickConnectors} connectors; native 44-radius mesh math, group association is a Web adapter.`)
