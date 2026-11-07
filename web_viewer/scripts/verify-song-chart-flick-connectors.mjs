import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { compileSongFlickConnectors } from '../src/presentation/SongTrackFlickConnectors.js'
import { buildSongChartGeometry } from '../src/presentation/SongChartPresentation.js'
import { chartGeometryWindow } from '../src/presentation/SongChartViewport.js'
import { buildSongTrackGeometry } from '../src/presentation/SongTrackPresentation.js'

// Native rule (NoteScrObj.GetEventNotesByDifficulty): isFlickEnd list in time order, next same-group entry.
const note = (sourceIndex, type, tick, flickgroup, extra = {}) => ({ sourceIndex, type, tick, flickgroup, duration: 0, start: 1, end: 2, ...extra })
const ids = chart => compileSongFlickConnectors(chart).map(c => `${c.fromNote.sourceIndex}>${c.toNote.sourceIndex}`)
assert.deepEqual(ids({ notes: [
  note(1, 'FLICK_LEFT', 100, 7),
  note(2, 'HOLD', 50, 7, { duration: 300 }),                                // ordinary hold: neither source nor target
  note(3, 'HOLD', 200, 7, { duration: 100, endtype: 'END_FLICK_UP', poly: [{ subtick: 0, posx: 3 }, { subtick: 100, posx: 4 }] }),
  note(4, 'FLICK_UP', 400, 7),
  note(5, 'FLICK_UP', 400, 0),                                              // group 0 never links
  note(6, 'FLICK_RIGHT', 400, 8), note(7, 'FLICK_RIGHT', 400, 8),           // same tick: list order decides
] }), ['1>3', '3>4', '6>7'])
const [toHold] = compileSongFlickConnectors({ notes: [note(1, 'FLICK_LEFT', 0, 1), note(2, 'HOLD', 10, 1, { duration: 5, endtype: 'END_FLICK_LEFT', poly: [{ subtick: 0, posx: 3 }, { subtick: 5, posx: 0 }] })] })
assert.equal(toHold.toLane, 3, 'a flick-tailed hold target joins at its head lane')

// Corpus: perspective, long track and export draw the same connectors.
const root = new URL('../public/data/song_charts/', import.meta.url)
let charts = 0, connectors = 0, crossing = 0
for (const file of readdirSync(root).filter(f => /^\w+-\d\.json$/.test(f))) {
  const chart = JSON.parse(readFileSync(new URL(file, root)))
  const expected = compileSongFlickConnectors(chart).filter(c => c.toTick > c.fromTick).map(c => c.id).sort()
  const geometry = buildSongChartGeometry(chart, 90)
  assert.deepEqual(geometry.flickConnectors.map(c => c.id).sort(), expected, `${file}: long track connectors`)
  for (const c of geometry.flickConnectors) {
    assert.ok(c.bodyTriangles.length > 0, `${file} ${c.id}: drawn`)
    const edge = Math.floor(c.endY / 768) * 768
    if (edge > c.y && edge < c.endY) {
      crossing++
      for (const [from, to] of [[edge - 768, edge], [edge, edge + 768]]) assert.ok(chartGeometryWindow(geometry, from, to).flickConnectors.some(w => w.id === c.id), `${file} ${c.id}: both slices`)
    }
  }
  charts++; connectors += expected.length
}
assert.ok(charts >= 244 && connectors > 1900, `${charts} charts / ${connectors} connectors`)
assert.ok(crossing > 0, 'some connector crosses a tile edge')

// The perspective track consumes the same list.
const dense = JSON.parse(readFileSync(new URL('brndnf-4.json', root)))
const first = compileSongFlickConnectors(dense).find(c => c.toTick > c.fromTick)
const denseGeometry = buildSongChartGeometry(dense, 90), firstTile = chartGeometryWindow(denseGeometry, 0, 768).flickConnectors
assert.ok(firstTile.length < denseGeometry.flickConnectors.length && firstTile.every(c => c.y <= 768 + 24), 'a slice mounts only nearby connectors')
assert.ok(buildSongTrackGeometry(dense, first.fromTick, 4000).holds.some(h => h.id === first.id), 'perspective draws the connector')

// Both long-track renderers (screen slice and export, which renders the same slice) draw them.
const slice = readFileSync(new URL('../src/components/archive/ArchiveSongChartSlice.vue', import.meta.url), 'utf8')
assert.match(slice, /window\.flickConnectors/, 'slice renders flick connectors')
console.log(`Flick connectors: native next-flick rule, ${connectors} connectors in ${charts} charts on perspective/long/export, ${crossing} crossing tile edges`)
