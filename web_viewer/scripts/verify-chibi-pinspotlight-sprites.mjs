import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createPinspotlightSprites, destroyPinspotlightSprites, pinspotlightModelForAsset, PINSPOTLIGHT_MASK_FRAGMENT } from '../src/core/chibiPinspotlightSprites.js'
const native = JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-pinspotlight-prefab.json',import.meta.url),'utf8')).model
class Sprite {
  constructor(texture) { this.texture=texture; this.anchor={set(...a){this.value=a}}; this.position={set(...a){this.value=a}}; this.scale={set(...a){this.value=a}} }
  removeFromParent(){this.removed=true} destroy(){this.destroyed=true}
}
class Filter { constructor(v,f){this.fragment=f} set maskSprite(s){this.mask=s;s.renderable=false} destroy(){this.destroyed=true} }
const runtime = createPinspotlightSprites({Sprite,SpriteMaskFilter:Filter,BLEND_MODES:{ADD:1}}, {addChild(...a){assert.equal(a.length,2)}},1,native.layers,[{},{}])
assert.equal(runtime.maskSprite.renderable,false)
assert.equal(runtime.sprite.tint,0)
assert.deepEqual(runtime.sprite.anchor.value,[.5,.5])
assert.equal(runtime.filter.fragment,PINSPOTLIGHT_MASK_FRAGMENT)
destroyPinspotlightSprites(runtime)
assert.ok(runtime.sprite.destroyed && runtime.maskSprite.destroyed && runtime.filter.destroyed)
const assets={pinspotlight:{file:'base.png'},fx:{file:'variant.png'}}
assert.deepEqual(pinspotlightModelForAsset(native,assets,'fx').layers.map(l=>l.asset),['fx','pinspotlight'])
assert.equal(pinspotlightModelForAsset(native,{},'fx'),null)
const source=fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
const section=source.slice(source.indexOf('async function syncPinspotlights('),source.indexOf('function imageLayerStatesAt('))
const ref=value=>({value}); const time=ref(100),lighting=ref(true),beam=ref(true),ids=ref([]),count=ref(0),maskCount=ref(0)
const states=new Map([[1,{id:1,asset:'fx',alpha:1,point:{x:0,y:0},x:0,y:360,beamColor:'#ff00cc',depth:1850}]])
const runtimes=new Map();let backgroundSyncs=0
const store={ensure(key,model){if(!runtimes.has(key))runtimes.set(key,createPinspotlightSprites({Sprite,SpriteMaskFilter:Filter,BLEND_MODES:{ADD:1}},{addChild(){}},key,model.layers,[{},{}]));return runtimes.get(key)},release(){for(const r of runtimes.values())destroyPinspotlightSprites(r);runtimes.clear()}}
const bg={sprite:{filters:[{}]}}
const api=new Function('app','cameraContainer','pinspotlightStatesAt','stageTime','visiblePinspotlightCount','visiblePinspotlightIds',
 'pinspotlightRuntimes','lightingEnabled','beamEffectsEnabled','pinspotlightModelForAsset','stageEffectIndex','pinspotlightSprites',
 'environmentScale','layoutCoordinatesForStage','projectChibiGround','selectedSong','parseHexColor','syncSpotlightBackground',
 'spotlightBackgroundSprites','pinspotlightMaskCount',section+'\nreturn {sync:syncPinspotlights,release:releasePinspotlights}')(
 {renderer:{width:1280,height:720,resolution:1}},{},()=>states,time,count,ids,runtimes,lighting,beam,
 pinspotlightModelForAsset,{value:{pinspotlight:native,assets}},store,ref(1),()=>({x:0,y:180}),()=>({x:640,y:540}),ref({songCode:'test'}),
 (color,fallback)=>color?parseInt(color.slice(1),16):fallback,()=>{backgroundSyncs++},{runtimes:new Map([['background',bg]])},maskCount)
await api.sync();const first=runtimes.get('1:fx')
assert.deepEqual(first.sprite.scale.value,[1], '512px native Sprite is not shrunk by empirical factors')
assert.deepEqual(first.sprite.position.value,[640,360])
assert.equal(first.sprite.alpha,1,'No synthetic 0.34 intensity factor')
assert.equal(first.maskSprite.alpha,1)
assert.equal(first.sprite.tint,0xff00cc)
assert.deepEqual(first.sprite.position.value,first.maskSprite.position.value)
beam.value=false;await api.sync();assert.equal(first.sprite.visible,false);assert.equal(first.maskSprite.visible,true)
assert.equal(count.value,0)
lighting.value=false;await api.sync();assert.equal(first.maskSprite.visible,false)
lighting.value=true;beam.value=true;states.set(1,{...states.get(1),asset:'missing',beamColor:null});await api.sync()
assert.equal(first.sprite.visible,false,'Previous asset cannot reappear after same-ID replacement')
assert.equal(runtimes.get('1:pinspotlight').sprite.tint,0,'Missing colour preserves native black default')
states.clear();await api.sync();assert.ok([...runtimes.values()].every(r=>!r.sprite.visible&&!r.maskSprite.visible))
api.release();assert.equal(runtimes.size,0);assert.equal(bg.sprite.filters,null);assert.ok(backgroundSyncs>0)
console.log('Real SFC native twin sprites, intensity, independent toggles, asset reuse, hide and disposal passed')

// Independent Unity -> Base -> camera matrix, including camera-space offset.
const {pinspotlightTimelineAt, pinspotlightPoint, PINSPOTLIGHT_TARGET_OFFSET} = await import('../src/core/chibiPinspotlightTimeline.js')
const stageScale = Math.fround(1000/720), pixelsPerUnit = 720/(2*5)*stageScale
const offset = Math.fround(150*Math.fround(stageScale/100))*pixelsPerUnit
assert.ok(Math.abs(PINSPOTLIGHT_TARGET_OFFSET-offset)<0.00001)
const placement=(slot,time)=>({x:slot*100+time/100,y:180})
const show=(time,stagePosition,x=0,y=360,duration=1000)=>({time,id:1,stagePosition,x,y,duration,asset:'fx'})
let events=[show(0,2)]
let state=pinspotlightTimelineAt(events,500,placement).get(1)
assert.equal(state.point.x,200,'Initial Show snaps before its tween')
assert.ok(Math.abs(state.point.y-(180-offset))<0.00001)
assert.equal(pinspotlightTimelineAt(events,1200,placement).get(1).point.x,212,'Target follows after movement completes')
events.push(show(2000,3))
state=pinspotlightTimelineAt(events,2500,placement).get(1)
assert.ok(state.point.x>320,'Native OutBack overshoots instead of linear motion or instant binding')
assert.equal(pinspotlightTimelineAt(events,3000,placement).get(1).point.x,330)
events.push({time:4000,id:1,hide:true,duration:1000})
state=pinspotlightTimelineAt(events,4500,placement).get(1)
assert.equal(state.alpha,0.25,'Hide defaults to OutQuad')
assert.equal(state.point.x,340,'Hide kills movement and freezes the target position')
events.push(show(4600,null,100,360))
state=pinspotlightTimelineAt(events,4600,placement).get(1)
assert.equal(state.alpha,1,'Show during a fade restores serialized alpha')
assert.ok(Math.abs(state.point.x-Math.fround(stageScale/100)*100*100)<0.00001,'Free position unbinds the old performer')
assert.deepEqual(pinspotlightTimelineAt(events,2500,placement),pinspotlightTimelineAt(events.slice(0,2),2500,placement),'Backward seek has no future state')
// Every published arrangement, forward and backward, uses source position rows.
const corpus=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/choreography/index.json',import.meta.url),'utf8'))
let commands=0, arrangements=0
for(const song of corpus.songs){
 if(!song.pinspotlightEvents?.length)continue
 arrangements++;commands+=song.pinspotlightEvents.length
 const locate=(slot,time)=>{const p=song.positionEvents?.findLast(e=>e.position===slot&&e.time<=time); return p||{x:0,y:180}}
 for(const time of [6000,9000,20000,6000]) for(const value of pinspotlightTimelineAt(song.pinspotlightEvents,time,locate).values()){
  assert.ok(value.alpha>=0&&value.alpha<=1)
  assert.ok(value.point&&Number.isFinite(value.point.x)&&Number.isFinite(value.point.y))
 }
}
console.log(`Native pin geometry, binding/unbinding, OutBack, interrupted hide and ${commands} commands across ${arrangements} arrangements passed`)
