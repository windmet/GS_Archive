import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { bodyColorsAt, multiplyBodyTint } from '../src/core/chibiBodyColors.js'
import { buildStageVfxCoverage } from '../src/core/stageVfxCoverage.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/chibi-take-body-colors.json', import.meta.url), 'utf8'))
const first = fixture.songs.tkstp1_live_effect.events
const second = fixture.songs.tkstp2_live_effect.events
assert.equal(bodyColorsAt(first, 0).get(3), 0x858386) // white mixed 55% with #221d23
assert.equal(bodyColorsAt(first, 5400).get(3), 0xffffff) // named hide faded over 3s
assert.equal(bodyColorsAt(first, 22400).get(3), 0xffffff) // performer 1 is central stage position 3
assert.equal(bodyColorsAt(first, 22400).get(2), 0x818183)
assert.equal(bodyColorsAt(first, 26000).get(5), 0xffffff)
assert.equal(bodyColorsAt(first, 26000).get(3), 0x6a6a6d)
assert.equal(bodyColorsAt(second, 22400).get(2), 0xffffff)
assert.equal(bodyColorsAt(second, 26000).get(4), 0xffffff)
assert.notEqual(bodyColorsAt(second, 26000).get(5), 0xffffff)
const transitions = [
  {time:0,stagePosition:3,color:'#000000',opacity:1000,duration:100},
  {time:50,stagePosition:3,hide:true,duration:100},
]
assert.equal(bodyColorsAt(transitions, 100).get(3), 0xc0c0c0) // interrupted at 50% grey
assert.equal(bodyColorsAt(transitions, 150).get(3), 0xffffff)
assert.deepEqual(bodyColorsAt(first, 22400), bodyColorsAt(first, 22400))
bodyColorsAt(first, 118000)
assert.equal(bodyColorsAt(first, 22400).get(3), 0xffffff)
assert.equal(bodyColorsAt([]).size, 0)
assert.equal(bodyColorsAt([{time:0,stagePosition:null,hide:true}], 0).size, 0)
assert.equal(multiplyBodyTint(0x808080, 0x808080), 0x404040)
assert.equal(multiplyBodyTint(0xb3b3b3, 0x333333), 0x242424) // older wash and independent body tint compose
assert.equal(multiplyBodyTint(0x123456), 0x123456)
assert.equal(buildStageVfxCoverage({bodyColorEvents:first}).sourceEvents.bodyColor, 69)

if (process.argv.includes('--published-assets')) {
  const index = JSON.parse(readFileSync(new URL('../public/assets/live-chibi/choreography/index.json', import.meta.url), 'utf8'))
  assert.equal(index.stats.bodyColorEvents, 1188)
  assert.equal(index.songs.filter(song => song.bodyColorEvents.length).length, 15)
  for (const [id, expected] of Object.entries(fixture.songs)) {
    assert.deepEqual(index.songs.find(song => song.id === id).bodyColorEvents, expected.events)
  }
  for (const song of index.songs) {
    const mapping = new Map(song.stagePositionMap.map(entry => [entry.performerSlot, entry.stagePosition]))
    for (const event of song.bodyColorEvents) assert.equal(event.stagePosition, mapping.get(event.performerSlot))
    const end = bodyColorsAt(song.bodyColorEvents, song.duration)
    bodyColorsAt(song.bodyColorEvents, 0)
    assert.deepEqual(bodyColorsAt(song.bodyColorEvents, song.duration), end)
  }
  console.log('Published body colors: 1188 commands, 15 arrangements, fixture and stage identity checks passed')
}
console.log('Body color sampling: central/right soloists, second version positions, hide/interruption and seek reset passed')
