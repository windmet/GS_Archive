import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { imageObjectsAt, imageObjectLayout } from '../src/core/chibiImageObjects.js'
import { buildStageVfxCoverage } from '../src/core/stageVfxCoverage.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/chibi-take-image-objects.json',import.meta.url),'utf8'))
const index = fixture.index
const take = index.songs.tkstp1_live_effect.events
const visible = (events, time) => [...imageObjectsAt(events, time).values()].filter(s => s.alpha > 0)
assert.equal(visible(take, 21300).length, 0)
assert.equal(visible(take, 21450)[0].alpha, .5)
assert.equal(visible(take, 22000)[0].asset, 'stage_tkstp1_fx_in_imageobject_16b')
assert.equal(visible(take, 25050)[0].alpha, .5)
assert.equal(visible(take, 25200).length, 0)
assert.equal(visible(take, 26000)[0].asset, 'stage_tkstp1_fx_in_imageobject_8b')
assert.equal(visible(take, 50851).length, 0) // authored early hide overrides nominal final hold
const before = imageObjectsAt(take, 22000)
imageObjectsAt(take, 48000)
assert.deepEqual(imageObjectsAt(take, 22000), before)
assert.equal(imageObjectsAt().size, 0)
const create = {type:'create',time:0,id:1,asset:'a',opacity:500,x:0,y:360,scaleX:1000,scaleY:1000,rotation:0}
const show = {type:'show',time:0,id:1,delay:20,fadeIn:100,hold:100,fadeOut:100}
const interrupted = [create,show,{type:'hide',time:70,id:1,asset:'a',duration:100}]
assert.equal(imageObjectsAt(interrupted,19).get(1).alpha,0)
assert.equal(imageObjectsAt(interrupted,120).get(1).alpha,.125)
assert.equal(imageObjectsAt(interrupted,170).get(1).alpha,0)
assert.equal(imageObjectsAt([...interrupted,{...create,time:200,asset:'b'},{...show,time:200,delay:0}],260).get(1).asset,'b')
assert.equal(imageObjectsAt([show],100).size,0) // no identity guessing
for (const [width,height] of [[1280,720],[357,201],[321,180],[800,500]]) {
  const state = visible(take,22000)[0]
  const position = imageObjectLayout(state,width,height)
  const fit = Math.min(width/1280,height/720)
  assert.equal(position.x,width/2-10*fit)
  assert.equal(position.y,height/2-100*fit)
  assert.equal(position.scaleX,.25*fit)
}
for (const song of Object.values(index.songs)) {
  for (const event of song.events.filter(e => e.type === 'show')) {
    const shown = visible(song.events,event.time+event.delay+event.fadeIn+10)
    assert.equal(shown.length,1)
    assert.ok(index.assets[shown[0].asset])
  }
}
assert.equal(Object.keys(index.assets).length,16)
const coverage = buildStageVfxCoverage({id:'tkstp1_live_effect'},{imageObjects:index})
assert.equal(coverage.sourceEvents.imageObject,24)
assert.equal(coverage.resourceAssets.imageObject,8)
assert.equal(coverage.missingMedia.length,0)
if (process.argv.includes('--published-assets')) {
  const root = new URL('../public/assets/live-chibi/',import.meta.url)
  const published = JSON.parse(readFileSync(new URL('image-objects/index.json',root),'utf8'))
  assert.deepEqual(published,index)
  for (const entry of Object.values(published.assets)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(entry.file,root))).digest('hex'),entry.pngSha256)
  }
  console.log('Published pilot: 48 exact commands and 16 PNG source identities/hash bindings passed')
}
console.log('ImageObjects: independent phases, authored hides, ID replacement, deterministic seeks and responsive placement passed')
