import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildSongChartTiming } from '../src/presentation/SongChartTiming.js'
import { buildSongChartColumns, songChartColumnAt } from '../src/presentation/SongChartPresentation.js'
const root = new URL('../public/data/', import.meta.url)
const fixture = { offset: .025, maxTick: 1920, tempos: [{tick:0,tempo:120},{tick:960,tempo:60}] }
const time = buildSongChartTiming(fixture)
assert.equal(time.tickToSeconds(480), .525)
assert.equal(time.tickToSeconds(960), 1.025)
assert.equal(time.tickToSeconds(1440), 2.025)
assert.equal(time.duration, 3.025)
assert.equal(time.secondsToTick(2.025), 1440)
const cafe = JSON.parse(readFileSync(new URL('song_charts/knwonl-4.json',root)))
assert.ok(Math.abs(buildSongChartTiming(cafe).tickToSeconds(74400)-71.53846153846153)<1e-8)
const catalog = JSON.parse(readFileSync(new URL('song_catalog.json',root)))
let charts=0, columns=0
for (const song of Object.values(catalog.songs)) for (const difficulty of song.gameplay.difficulties) {
  const chart = JSON.parse(readFileSync(new URL(difficulty.chart.url.replace('/data/',''),root)))
  const timing=buildSongChartTiming(chart)
  for(const n of chart.notes) for(const tick of [n.tick,n.tick+n.duration]) {
    assert.ok(Math.abs(timing.secondsToTick(timing.tickToSeconds(tick))-tick)<1e-6)
  }
  for(const scale of [55,90,150]) {
    const parts=buildSongChartColumns(chart,scale)
    assert.ok(Math.abs(parts[0].from)<1e-6);assert.equal(parts.at(-1).to,chart.maxTick)
    const duration=parts[0].toSeconds-parts[0].fromSeconds
    for(const [i,p] of parts.entries()) {
      assert.ok(Math.abs(p.toSeconds-p.fromSeconds-duration)<1e-8)
      assert.ok(p.height<=520.001)
      assert.equal(songChartColumnAt(parts,p.from+.001),i)
      if(i)assert.ok(Math.abs(p.from-parts[i-1].to)<1e-6)
    }
    assert.equal(songChartColumnAt(parts,chart.maxTick),parts.length-1)
    columns+=parts.length
  }
  charts++
}
console.log(`Chart timing verified: ${charts} charts, ${columns} equal-duration columns; tempo/offset boundaries and all head/tail round trips passed`)
