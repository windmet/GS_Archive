import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { buildSongChartTiming } from '../src/presentation/SongChartTiming.js'
import { compileSongFlickConnectors } from '../src/presentation/SongTrackFlickConnectors.js'
import { createSongTrackRenderer, projectTrackPoint, songTrackSpanForSpeed } from '../src/presentation/SongTrackPresentation.js'

const directory = new URL('../public/data/song_charts/', import.meta.url)
const stats = Object.fromEntries(['head', 'tail', 'middle', 'flick'].map(kind => [kind, { pairs: 0, samplePx: 0, meshPx: 0 }]))
let charts = 0, windows = 0, bpmBoundaries = 0

function compare(kind, note, hold, scene) {
  if (!note || note.tick < hold.from || note.tick > hold.to) return
  const sample = hold.samples.find(s => s.tick === note.tick)
  assert.ok(sample, 'Visible note without a corresponding Hold sample: ' + note.id)
  const point = projectTrackPoint(sample.lane, sample.fraction)
  const samplePx = Math.hypot(note.x - point.x, note.y - point.y)
  let meshPx = Infinity
  const { vertices } = hold.nativeMesh
  for (let i = 0; i < vertices.length; i += 2) {
    const a = vertices[i], b = vertices[i + 1]
    const x = scene.width / 2 + (a.x + b.x) / 2, y = scene.height / 2 - (a.y + b.y) / 2
    meshPx = Math.min(meshPx, Math.hypot(note.x - x, note.y - y))
  }
  const entry = stats[kind]
  entry.pairs++
  entry.samplePx = Math.max(entry.samplePx, samplePx)
  entry.meshPx = Math.max(entry.meshPx, meshPx)
  assert.ok(samplePx <= .001 && meshPx <= .01, JSON.stringify({ kind, note: note.id, tick: scene.cursor, samplePx, meshPx }))
}

for (const file of readdirSync(directory).filter(file => file.endsWith('.json'))) {
  const chart = JSON.parse(readFileSync(new URL(file, directory), 'utf8'))
  if (!chart.notes?.length || !chart.tempos?.length) continue
  charts++
  const timing = buildSongChartTiming(chart), render = createSongTrackRenderer(chart)
  const flicks = new Map(compileSongFlickConnectors(chart).map(link => [link.id, link]))
  const seconds = [.1, .4, .6, .8].map(fraction => timing.duration * fraction)
  for (const segment of timing.segments.slice(1)) {
    bpmBoundaries++
    seconds.push(segment.seconds - .75, segment.seconds - .2, segment.seconds + .05)
  }
  for (const time of seconds) {
    windows++
    const cursor = timing.secondsToTick(time), scene = render(cursor, songTrackSpanForSpeed(5, timing, cursor))
    const glyphs = new Map(scene.glyphs.map(note => [note.id, note]))
    for (const hold of scene.holds) {
      if (hold.flickConnector) {
        const link = flicks.get(hold.id)
        const head = glyphs.get(link.fromNote.sourceIndex + (link.fromTick === link.fromNote.tick ? '-head' : '-tail'))
        const tail = glyphs.get(link.toNote.sourceIndex + '-head')
        compare('flick', head, hold, scene)
        compare('flick', tail, hold, scene)
      } else {
        compare('head', glyphs.get(hold.id + '-head'), hold, scene)
        compare('tail', glyphs.get(hold.id + '-tail'), hold, scene)
        for (const middle of scene.middleNodes) {
          if (middle.sourceIndex === hold.id) compare('middle', middle, hold, scene)
        }
      }
    }
  }
}
for (const entry of Object.values(stats)) assert.ok(entry.pairs > 0)
console.log(JSON.stringify({ charts, windows, bpmBoundaries, stats }, null, 2))
