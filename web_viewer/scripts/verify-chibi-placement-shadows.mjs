import { spotlightSortOffsetsAt } from '../src/core/chibiCharacterLayers.js'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { chibiPositionStateAt, resolveChibiPlacement, projectChibiGround } from '../src/core/chibiStageCoordinates.js'
import { characterShadowLayout, installCharacterShadowFollower } from '../src/core/chibiCharacterShadow.js'
const read = name => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url)))
const witnesses = read('chibi-placement-witness')
const sfc = fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
const section = sfc.slice(sfc.indexOf('function sourceSlotForStagePosition('),sfc.indexOf('function cameraStateAt('))
function sampler(song) {
  const events = new Map()
  for (const event of song.events) {
    const list=events.get(event.stagePosition)||[];list.push(event);events.set(event.stagePosition,list)
  }
  return new Function('selectedSong','performanceEventsByPosition','stageTime','chibiPositionStateAt','resolveChibiPlacement',
    section+';return layoutCoordinatesForStage')({value:song},{value:events},{value:0},chibiPositionStateAt,resolveChibiPlacement)
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
assert.equal(possibilities(4,1799).sortingOrder,1700)
for (const time of [1800,1975,2150,3449,1800]) assert.equal(possibilities(4,time).sortingOrder,1900)
assert.equal(possibilities(4,3450).sortingOrder,1700)
const namedSong = structuredClone(witnesses.psblts_live_effect)
for (const e of namedSong.positionEvents) { e.sortingOrder=e.scale; delete e.scale }
const named = sampler(namedSong)
for (const time of [-3000,-2000,1799,1800,3450,52000]) {
  const {positionState: legacyState,...legacyCoordinates}=possibilities(4,time)
  const {positionState: namedState,...namedCoordinates}=named(4,time)
  assert.deepEqual(namedCoordinates,legacyCoordinates,'Named and legacy indexes must produce identical placement')
  assert.equal(namedState?.time,legacyState?.time)
}
const changes=[{time:0,position:1,x:10,y:180,sortingOrder:0},{time:100,position:1,x:50,y:200,sortingOrder:2600}]
assert.equal(chibiPositionStateAt(changes,1,-1),null,'Future formation cannot be applied early')
assert.equal(resolveChibiPlacement(chibiPositionStateAt(changes,1,0),null,0).sortingOrder,0,'Explicit zero is an authored order')
assert.deepEqual(chibiPositionStateAt(changes,1,100),changes[1],'Position and order change at the command timestamp')
assert.equal(resolveChibiPlacement({x:5000,y:5000,scale:1700},{time:100,x:0,y:180},0).y,5000)
assert.equal(resolveChibiPlacement(null,{x:12,y:250},0).x,12)
// Exercise the actual layout consumer: value4 changes order without changing
// the prefab size, including the source's 2600 foreground order.
const actor={characterId:'test',spine:{scale:{set(value){this.x=value;this.y=value}}}}
const stageTime={value:1799}
const layoutSong={...witnesses.psblts_live_effect,positionEvents:[
  {time:-2000,position:3,x:350,y:230,sortingOrder:1700},
  {time:1800,position:3,x:350,y:230,sortingOrder:2600},
]}
const layout=new Function('runtimes','app','canvasRef','stageTime','layoutCoordinatesForStage','characters','selectedSong',
  'projectChibiGround','CHARACTER_STAGE_SCALE','charactersEnabled','activePositions','syncCharacterShadow','lightingEnabled','spotlightSortOffsetsAt',
  sfc.match(/function layoutRuntime\([^]*?\n\}/)[0]+';return layoutRuntime')(
  new Map([[4,actor]]),{renderer:{width:1280,height:720,resolution:1}},{value:{}},stageTime,sampler(layoutSong),
  {value:[{id:'test',previewScale:.3}]},{value:layoutSong},projectChibiGround,.58,{value:true},{value:[4]},()=>{},{value:true},spotlightSortOffsetsAt)
layout(4);const initialSize=actor.spine.scale.x
assert.equal(actor.spine.zIndex,1700)
stageTime.value=1800;layout(4)
assert.equal(actor.spine.zIndex,2600);assert.equal(actor.spine.scale.x,initialSize)
assert.equal(actor.spine.x,990);assert.equal(actor.spine.y,490)
stageTime.value=1799;layout(4);assert.equal(actor.spine.zIndex,1700)
layoutSong.spotlightEvents=[{time:1799,id:1,stagePosition:4}];layout(4);assert.equal(actor.spine.zIndex,1950,'Late motion layout must preserve the active Spotlight offset')
layoutSong.spotlightEvents=[]
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
assert(sfc.includes('installCharacterShadowFollower(runtime.spine'))
assert(sfc.includes('syncCharacterShadow(runtime)'))
assert(sfc.includes('runtime.spine.zIndex = sortingOrder + offset'))
assert(sfc.includes('shadow.zIndex = runtime.spine.zIndex - 10'))
assert(!sfc.includes('sourceScale / 1700'))
if (process.argv.includes('--published-assets')) {
  const index=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/stage-effects/index.json',import.meta.url)))
  assert.deepEqual(index.characterShadow,profile)
  assert.equal(index.assets[profile.asset].source.pathId,'932')
}
console.log('PASS placement/shadows: immediate authored order, legacy/named indexes, platform depth, unit variants, offstage, backward seek, native oval and post-pose bone follower')
