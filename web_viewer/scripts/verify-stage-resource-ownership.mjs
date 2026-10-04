import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import {customRef,isRef,unref} from 'vue'
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
console.log(`Stage resource ownership: ${cases} actual SFC delayed shadow/texture, retry, bounded motion and sibling failure cases passed; no GPU/device claim`)
