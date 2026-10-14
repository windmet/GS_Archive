import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import {customRef,isRef,unref} from 'vue'
import {constantSuspensionTempo} from '../src/core/chibiSuspensionlights.js'
const source=await readFile(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
const ref=value=>({value})
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()}
function install(context,names){vm.createContext(context);for(const name of names){const body=source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`));assert(body,`Actual SFC function missing: ${name}`);vm.runInContext(body[0],context)}}
let cases=0
{
  const context={customRef};vm.createContext(context)
  vm.runInContext(source.match(/const frameValue = [^\r\n]+/)[0]+';this.frameValue=frameValue',context)
  let value=[1,2,3];const frame=context.frameValue(()=>value)
  assert.ok(isRef(frame),'Frame readers must unwrap in Vue templates')
  assert.equal(unref(frame).join(','),'1,2,3');value=[4,5]
  assert.equal(unref(frame).join(','),'4,5','Renderer reads exact frame state without computed caching');cases++
}
{
  const gate=deferred(),runtime={stagePosition:1,spine:{}},added=[]
  const context={stageDisposed:false,app:{render(){}},playing:ref(false),characterShadowTexture:null,characterShadowLoad:null,
    stageEffectIndex:ref({characterShadow:{asset:'shadow'},assets:{shadow:{file:'shadow.png'}}}),loadImageLayerTexture:()=>gate.promise,
    runtimes:new Map([[1,runtime]]),cameraContainer:{addChild(value){added.push(value)}},markRaw:x=>x,
    PIXI:{Sprite:class{constructor(){this.anchor={set(){}}}}},installCharacterShadowFollower:()=>()=>{},syncCharacterShadow(){}}
  install(context,['ensureCharacterShadowTexture','attachStageShadow'])
  const pending=context.attachStageShadow(runtime);await flush();context.runtimes.set(1,{stagePosition:1})
  gate.resolve({destroy(){}});await pending;assert.equal(added.length,0,'Late shadow cannot attach to replaced actor');cases++
}
{
  const gate=deferred();let destroyed=0
  const context={stageDisposed:false,app:{},characterShadowTexture:null,characterShadowLoad:null,
    stageEffectIndex:ref({characterShadow:{asset:'shadow'},assets:{shadow:{file:'shadow.png'}}}),loadImageLayerTexture:()=>gate.promise}
  install(context,['ensureCharacterShadowTexture']);const pending=context.ensureCharacterShadowTexture()
  context.stageDisposed=true;context.app=null;gate.resolve({destroy(){destroyed++}})
  assert.equal(await pending,null);assert.equal(destroyed,1,'Late texture is released after leaving');cases++
}
{
  let calls=0
  const context={stageDisposed:false,app:{},characterShadowTexture:null,characterShadowLoad:null,
    stageEffectIndex:ref({characterShadow:{asset:'shadow'},assets:{shadow:{file:'shadow.png'}}}),loadImageLayerTexture:()=>++calls===1?Promise.reject(Error('texture failure')):Promise.resolve({})}
  install(context,['ensureCharacterShadowTexture']);await assert.rejects(context.ensureCharacterShadowTexture(),/failure/)
  await context.ensureCharacterShadowTexture();assert.equal(calls,2,'Rejected shadow can be retried');cases++
}
for(const mode of ['success','cancel','failure']){
  const abort=new AbortController(),gates=[];let running=0,maximum=0,started=0
  const runtimes=new Map([1,2,3,4,5].map(position=>[position,{stagePosition:position,preloadedSongs:new Set()}]))
  const context={AbortController,selectedSong:ref({id:'song',motionIds:[1,2,3,4]}),stageReady:ref(true),runtimes,
    activeSlots:ref([...runtimes.keys()].map(position=>({position}))),motionCatalog:ref(new Map([1,2,3,4].map(id=>[id,{id}]))),
    songMotionsReady:ref(false),preloading:ref(false),preloadProgress:ref(0),audioError:ref(''),console:{error(){}},
    injectLiveChibiMotion:async(_runtime,_motion,{signal})=>{started++;running++;maximum=Math.max(maximum,running);const gate=deferred();gates.push(gate);signal.addEventListener('abort',()=>gate.reject(new DOMException('Cancelled','AbortError')),{once:true});try{await gate.promise}finally{running--}}}
  install(context,['preloadSongMotions'])
  const pending=context.preloadSongMotions({signal:abort.signal,current:()=>!abort.signal.aborted});await flush()
  assert.equal(started,3,'Five actors do not start actor × motion jobs all at once')
  if(mode==='cancel')abort.abort()
  else if(mode==='failure')gates[0].reject(Error('motion failure'))
  else{for(let i=0;i<24;i++){for(const gate of gates.splice(0))gate.resolve();await flush()}}
  assert.equal(await pending,mode==='success');await flush();assert.equal(running,0)
  assert.ok(maximum<=3);for(const runtime of runtimes.values())assert.equal(runtime.preloadedSongs.has('song'),mode==='success')
  if(mode!=='success')assert.equal(started,3,'Failed/cancelled batch stops the remaining queue');cases++
}
{
  let rendered=0,cameraSynced=0;const queued=[]
  const context={app:{render(){rendered++}},playing:ref(false),stageDisposed:false,suspensionRenderQueued:false,
    queueMicrotask:callback=>queued.push(callback),applyCameraTransform(){cameraSynced++}}
  install(context,['requestPausedSuspensionRender'])
  context.requestPausedSuspensionRender();context.requestPausedSuspensionRender()
  assert.equal(queued.length,1,'Multiple late lamps coalesce into one paused render')
  queued.shift()();assert.equal(rendered,1)
  assert.equal(cameraSynced,1,'A late paused lamp samples the current shared camera before drawing')
  context.requestPausedSuspensionRender();context.playing.value=true;queued.shift()();assert.equal(rendered,1)
  context.playing.value=false;context.requestPausedSuspensionRender();context.app={render(){rendered++}}
  queued.shift()();assert.equal(rendered,1,'A released application cannot render the new stage')
  context.requestPausedSuspensionRender();context.stageDisposed=true;queued.shift()();assert.equal(rendered,1)
  assert.match(source,/onReady: \(\) => \{ syncSuspensionlights\(\); requestPausedSuspensionRender\(\) \}/)
  assert.match(source,/onReady: \(\) => \{ syncOldSuspensionlights\(\); requestPausedSuspensionRender\(\) \}/)
  cases++
}
for(const mode of ['late-tempo','failed-tempo','switch','dispose']){
  const requests=new Map();let repaints=0
  const context={AbortController,console:{warn(){}},stageDisposed:false,app:{},cameraContainer:{},
    selectedSong:ref({id:'first',songCode:'first'}),stageEffectIndex:ref({newSuspensionlightSongs:{first:{file:'first.json'},second:{file:'second.json'}}}),
    suspensionTrackKey:'',suspensionTrack:ref(null),suspensionTempo:ref(null),suspensionAbort:null,
    suspensionSprites:{runtimes:new Map(),release(){}},visibleSuspensionlightIds:ref([]),beamEffectsEnabled:ref(false),
    LIVE_CHIBI_BASE:'/live',constantSuspensionTempo,validateSongChart(){},requestPausedSuspensionRender(){repaints++},
    fetch(url){const gate=deferred();requests.set(url,gate);return gate.promise}}
  install(context,['syncSuspensionlights']);context.syncSuspensionlights()
  const track=requests.get('/live/first.json'),tempo=requests.get('/data/song_charts/first-1.json')
  if(mode==='switch'){
    context.selectedSong.value={id:'second',songCode:'second'};context.syncSuspensionlights()
  }
  if(mode==='dispose')context.stageDisposed=true
  track.resolve({ok:true,json:async()=>({events:[],identity:'first'})});await flush()
  if(mode==='switch'||mode==='dispose')assert.equal(context.suspensionTrack.value,null,'Late track cannot attach after song switch/unmount')
  else assert.equal(context.suspensionTrack.value.identity,'first','A pending chart cannot block normal/color lamps')
  assert.equal(context.suspensionTempo.value,null)
  if(mode==='failed-tempo')tempo.reject(Error('missing chart'))
  else tempo.resolve({ok:true,json:async()=>({tempos:[{tempo:120}]})})
  await flush()
  assert.equal(context.suspensionTempo.value,mode==='late-tempo'?120:null,'Late tempo is scoped to its song and lifetime')
  if(mode==='failed-tempo')assert.equal(context.suspensionTrack.value.identity,'first','Chart failure preserves the loaded track')
  if(mode==='switch'||mode==='dispose')assert.equal(repaints,0)
  else assert.equal(repaints,2,'Both completions request a paused repaint')
  cases++
}
console.log(`Stage resource ownership: ${cases} actual SFC delayed shadow/texture, retry, bounded motion, independent lamp/tempo loading, stale completion and paused repaint cases passed; no GPU/device claim`)
