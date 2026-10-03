import assert from 'node:assert/strict'
import fs from 'node:fs'
import { resolveChibiPlacement } from '../src/core/chibiStageCoordinates.js'
import { characterShadowLayout, installCharacterShadowFollower } from '../src/core/chibiCharacterShadow.js'
const read = name => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url)))
const witnesses = read('chibi-placement-witness')
const sfc = fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
const section = sfc.slice(sfc.indexOf('function sourceSlotForStagePosition('),sfc.indexOf('function sampleCameraTween('))
function sampler(song) {
  const events = new Map()
  for (const event of song.events) {
    const list=events.get(event.stagePosition)||[];list.push(event);events.set(event.stagePosition,list)
  }
  return new Function('selectedSong','performanceEventsByPosition','stageTime','POSITION_TWEEN_MS','resolveChibiPlacement',
    section+';return layoutCoordinatesForStage')({value:song},{value:events},{value:0},350,resolveChibiPlacement)
}
const possibilities = sampler(witnesses.psblts_live_effect)
for (const time of [50000,51400,51500,52000,53299,53300,52000]) {
  assert.deepEqual([2,3,4].map(p=>{const c=possibilities(p,time);return [c.x,c.y]}),
    [[-350,270],[0,140],[350,230]], 'Motion 19019 must not exchange platform depth')
}
const duo=sampler(witnesses.byndtd_live_effect_03alt || Object.values(witnesses).find(s=>s.variant==='03alt'))
// Slot map is derived from actual independent formation coordinates.
for (const {stagePosition,performerSlot} of Object.values(witnesses).find(s=>s.variant==='03alt').stagePositionMap) {
  const source=Object.values(witnesses).find(s=>s.variant==='03alt').positionEvents.find(e=>e.position===performerSlot)
  assert.equal(duo(stagePosition,10000).x,source.x)
  assert.equal(duo(stagePosition,10000).y,source.y)
}
const start=possibilities(4,1800).scale, end=possibilities(4,2150).scale
assert.equal(start,1700);assert.equal(end,1900);assert(possibilities(4,1975).scale>start)
assert.equal(possibilities(4,1000).scale,1700)
assert.equal(resolveChibiPlacement({x:5000,y:5000,scale:1700},{time:100,x:0,y:180},0).y,5000)
assert.equal(resolveChibiPlacement(null,{x:12,y:250},0).x,12)
const profile=read('chibi-character-shadow-model')
const bone={worldX:25,worldY:38};const spine={x:300,y:500,scale:{x:.2,y:.2},skeleton:{findBone:name=>name==='shadow'?bone:null}}
const firstShadow=characterShadowLayout(spine,profile)
assert.equal(firstShadow.x,305);assert.equal(firstShadow.y,507.6)
assert(Math.abs(firstShadow.scaleX-.6)<1e-12 && Math.abs(firstShadow.scaleY-.6)<1e-12)
bone.worldX=125;assert.equal(characterShadowLayout(spine,profile).x,325)
spine.x=600;assert.equal(characterShadowLayout(spine,profile).x,625)
assert(Math.abs(profile.width*characterShadowLayout(spine,profile).scaleX-240)<1e-10)
assert(Math.abs(profile.height*characterShadowLayout(spine,profile).scaleY-48)<1e-10)
assert.equal(characterShadowLayout(spine,{...profile,bone:'missing'}),null)
const calls=[];const original=function(delta){bone.worldX+=delta;calls.push('pose')};spine.update=original
const release=installCharacterShadowFollower(spine,()=>calls.push(characterShadowLayout(spine,profile).x))
spine.update(10);assert.deepEqual(calls,['pose',627]);release();assert.equal(spine.update,original)
assert(sfc.includes('return resolveChibiPlacement(positionState, event, fallbackX)'))
assert(sfc.includes('installCharacterShadowFollower(stageRuntime.spine'))
assert(sfc.includes('syncCharacterShadow(runtime)'))
if (process.argv.includes('--published-assets')) {
  const index=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/stage-effects/index.json',import.meta.url)))
  assert.deepEqual(index.characterShadow,profile)
  assert.equal(index.assets[profile.asset].source.pathId,'932')
}
console.log('PASS placement/shadows: platform depth, unit variants, offstage, scale tween, seek, native oval and post-pose bone follower')
