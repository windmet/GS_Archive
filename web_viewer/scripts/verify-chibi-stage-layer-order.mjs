import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { createFlatStageLayers, backmonitorDepths } from '../src/core/chibiFlatStageLayers.js'
import { chibiBackmonitorStateAt } from '../src/core/chibiBackmonitorCoordinates.js'

const parent={children:[],addChild(child){this.children.push(child);child.parent=this}}
const owner=createFlatStageLayers(parent), child=new EventEmitter()
child.visible=false
owner.visible=false;owner.addChild(child)
assert.equal(child.parent,parent);assert.equal(child.renderable,false)
owner.visible=true;assert.equal(child.visible,false);assert.equal(child.renderable,true)
child.emit('removed');assert.equal(owner.children.length,0)
assert.deepEqual(backmonitorDepths({sortingOrder:1250},true),{movie:1250,back:1245,logo:1251,noise:1255,glow:1360})
assert.equal(backmonitorDepths({sortingOrder:1250},false).movie,-30000)
const controls=[{time:0,movie:'a',sortingOrder:1250,rawValue7:1100},{time:1000,movie:'a'},{time:2000,movie:'b'}]
assert.equal(chibiBackmonitorStateAt(controls,1500).movieTime,0)
assert.equal(chibiBackmonitorStateAt(controls,1500).sortingOrder,1000)
assert.equal(chibiBackmonitorStateAt(controls,1500).glowAlpha,0)
assert.equal(chibiBackmonitorStateAt(controls,2000).movieTime,2000)

// Exercise the actual async SFC consumer, including late upgrades and stale loads.
const source=readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
const code=source.slice(source.indexOf('async function syncStageBackground()'),source.indexOf('function applyImageColors()'))
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
function harness(orders=[1100,1300,1500]) {
  const waits=orders.map(deferred),textures=orders.map(()=>({destroyed:false,destroy(){this.destroyed=true}}))
  const ids=orders.map((_,i)=>`part${i}`),old={id:'composite'}
  const c={cameraContainer:{children:[],addChild(s){this.children.push(s)}},selectedSong:{value:{songCode:'song'}},
    stageBackgroundIndex:{value:{songs:{song:{layers:ids,file:'fallback'}},components:{songs:{song:{layers:ids}},assets:Object.fromEntries(ids.map((id,i)=>[id,{file:id,sortingOrder:orders[i]}]))}}},
    stageBackgroundSongId:{value:'song'},stageBackgroundPendingKey:'',stageBackgroundSprite:old,stageBackgroundSequence:0,
    stageBackgroundParts:new Map(),stageBackgroundNativeLayers:{value:false},backgroundComponentCount:{value:0},stageBackgroundReady:{value:true},staticStageEnabled:{value:true},currentBackmonitorState:{value:{}},
    markRaw:x=>x,PIXI:{Sprite:class{constructor(t){this.texture=t;this.anchor={set(){}}}}},
    loadImageLayerTexture:file=>waits[ids.indexOf(file)].promise,
    clearStageBackgroundArt(){c.stageBackgroundSprite=null;c.stageBackgroundParts.clear()},releaseStageBackground(){throw Error('unexpected release')},
    layoutStageBackground(){},applyImageColors(){},layoutBackmonitor(){},console:{warn(){}}}
  const run=new Function('c',`with(c){${code};return syncStageBackground}`)(c)
  return {c,run,waits,textures,old}
}
let h=harness(),pending=h.run()
h.waits[0].resolve(h.textures[0]);await Promise.resolve()
assert.equal(h.c.stageBackgroundSprite,h.old,'retain composite until all parts load')
assert.equal(h.c.stageBackgroundParts.size,0)
for(let i=1;i<3;i++)h.waits[i].resolve(h.textures[i]);await pending
assert.equal(h.c.stageBackgroundSprite,null);assert.equal(h.c.stageBackgroundNativeLayers.value,true)
assert.deepEqual([...h.c.stageBackgroundParts.values()].map(x=>x.sprite.zIndex),[1100,1300,1500])
h=harness();pending=h.run();h.c.cameraContainer={};h.waits.forEach((w,i)=>w.resolve(h.textures[i]));await pending
assert(h.textures.every(t=>t.destroyed));assert.equal(h.c.stageBackgroundSprite,h.old)
h=harness([1100,null,1500]);pending=h.run();h.waits.forEach((w,i)=>w.resolve(h.textures[i]));await pending
assert.equal(h.c.stageBackgroundNativeLayers.value,false)
assert.deepEqual([...h.c.stageBackgroundParts.values()].map(x=>x.sprite.zIndex),[-20000,-19999,-19998])
h=harness();pending=h.run();h.waits[0].reject(Error('missing'));h.waits.slice(1).forEach((w,i)=>w.resolve(h.textures[i+1]));await pending
assert.equal(h.c.stageBackgroundSprite,h.old);assert(h.textures.slice(1).every(t=>t.destroyed))

const repaint=source.slice(source.indexOf('function requestPausedBackmonitorRender()'),source.indexOf('const backmonitorLayerSprites'))
const jobs=[],app={renders:0,render(){this.renders++}},c={app,playing:{value:false},pausedBackmonitorRenderPending:false,stageDisposed:false,queueMicrotask:job=>jobs.push(job),applyCameraTransform(){}}
const request=new Function('c',`with(c){${repaint};return requestPausedBackmonitorRender}`)(c)
request();request();assert.equal(jobs.length,1);jobs.shift()();assert.equal(app.renders,1)
request();c.app={};jobs.shift()();assert.equal(app.renders,1,'discard repaint after owner replacement')
c.app=app;request();c.playing.value=true;jobs.shift()();assert.equal(app.renders,1)
console.log('Global layer ownership, native sort resets/movie phase, atomic upgrade/failure/stale load, paused repaint passed')
