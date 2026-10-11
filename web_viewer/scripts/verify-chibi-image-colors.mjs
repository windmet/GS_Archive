import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { imageColorsAt, compositeImageTint } from '../src/core/chibiImageColors.js'
import { buildStageVfxCoverage } from '../src/core/stageVfxCoverage.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/chibi-image-colors.json', import.meta.url), 'utf8'))
const first = fixture.songs.tkstp1.events
const second = fixture.songs.tkstp2.events
const layers = [1, 2, 3, 4, 5].map(number => `stage_tkstp1_0${number}`)
assert.equal(imageColorsAt(first, 22400).get(layers[0]), 0x287878)
assert.equal(imageColorsAt(first, 26000).get(layers[0]), 0x783c3c)
assert.equal(imageColorsAt(second, 26000).get('stage_tkstp2_01'), 0x64003c)
for (const event of first) for (const time of [event.time, event.time + event.duration / 2, event.time + event.duration]) {
  assert.equal(compositeImageTint(layers, imageColorsAt(first, time)).uniform, true)
}
assert.equal(compositeImageTint(['a', 'b'], new Map([['a', 0x123456], ['b', 0x123456]])).color, 0x123456)
assert.equal(compositeImageTint(['a', 'b'], new Map([['a', 0x123456]])).uniform, false)
assert.equal(compositeImageTint([]).color, 0xffffff)
const interrupted = [{time:0,asset:'a',color:'#000000',opacity:1000,duration:100},
  {time:50,asset:'a',hide:true,duration:100}]
assert.equal(imageColorsAt(interrupted, 100).get('a'), 0xc0c0c0)
assert.equal(imageColorsAt(interrupted, 150).get('a'), 0xffffff)
for (const code of ['ominut', 'plmask']) assert.equal(imageColorsAt(fixture.songs[code].events, 120000).size, 0)
imageColorsAt(first, 118000)
assert.equal(imageColorsAt(first, 22400).get(layers[0]), 0x287878)
assert.equal(buildStageVfxCoverage({imageColorEvents:first}).sourceEvents.imageColor, 115)
assert.equal(buildStageVfxCoverage({imageColorEvents:fixture.songs.ominut.events}).unresolvedImageColors.length, 3)

if (process.argv.includes('--published-assets')) {
  const root = new URL('../public/assets/live-chibi/', import.meta.url)
  const read = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'))
  const index = read('choreography/index.json')
  const backgrounds = read('stage-backgrounds/index.json')
  const components = read('image-components/index.json')
  assert.equal(index.stats.imageColorEvents, 2177)
  assert.equal(index.songs.filter(song => song.imageColorEvents.length).length, 15)
  assert.equal(index.songs.flatMap(song => song.imageColorEvents).filter(event => event.unresolvedReason).length, 4)
  for (const code of ['tkstp1','tkstp2']) assert.deepEqual(index.songs.find(song => song.songCode === code).imageColorEvents, fixture.songs[code].events)
  const indexes = {stageBackgrounds:backgrounds, imageLayers:read('image-layers/index.json'), imageObjects:read('image-objects/index.json')}
  for (const song of index.songs) assert.deepEqual(buildStageVfxCoverage(song, indexes).imageColorMissing, [])
  assert.equal(Object.keys(components.songs).length, 10)
  assert.equal(Object.keys(components.assets).length, 30)
  for (const [code, entry] of Object.entries(components.songs)) {
    assert.deepEqual(entry.layers, backgrounds.songs[code].layers)
    assert.equal(entry.compositePixelsIdentical, true)
  }
  console.log('Published Image_color: 2177 commands, all targets resolved, 10 independent backgrounds and 4 explicit unresolved commands passed')
}
console.log('Image tint sampling: independent assets, composite equality, hide, interruption and backward seek passed')
