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
assert.deepEqual(pinspotlightModelForAsset(native,assets,'fx').layers.map(l=>l.asset),['fx','fx'])
assert.equal(pinspotlightModelForAsset(native,{},'fx'),null)
const source=fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
const section=source.slice(source.indexOf('async function syncPinspotlights('),source.indexOf('function imageLayerStatesAt('))
const ref=value=>({value}); const time=ref(100),lighting=ref(true),beam=ref(true),ids=ref([]),count=ref(0),maskCount=ref(0)
const states=new Map([[1,{id:1,asset:'fx',alpha:1,x:0,y:360,beamColor:'#ff00cc',depth:1850}]])
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
