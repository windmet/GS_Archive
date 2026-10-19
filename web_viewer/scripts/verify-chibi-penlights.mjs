import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {validatePenlightData,penlightsAt,createPenlightSampler,penlightColor,penlightMeshInput,penlightActorMatrix} from '../src/core/chibiPenlights.js'
import {createPenlightRuntime,applyPenlightRuntime,releasePenlightRuntime} from '../src/core/chibiPenlightRenderer.js'

const node=(route,parent,x=0)=>({route,parent,activeSelf:true,position:{x,y:0,z:0},scale:{x:1,y:1,z:1},rotation:{x:0,y:0,z:0,w:1}})
const renderer=(route,index)=>({route,index,controllerKey:'c',spriteKey:'s',sortingOrder:8,renderState:{Enabled:true},initialColor:{r:0,g:0,b:1,a:1}})
const names=['Beat1','Beat2','Beat3','Wiper1','Wiper2','Wiper3','Wiper4','Yeah1','Yeah2','Yeah3']
const model={prefabs:[{name:'p',frontMiddleObjCount:2,nodes:[node('root',null),...[-2,0,2].map((x,i)=>node(`a${i}`,'root',x)),node('shadow','root')],actors:[0,1,2].map(i=>renderer(`a${i}`,i)),shadows:[renderer('shadow',0)]}],controllers:{c:{states:names.map(name=>({name,stateSpeed:1,clip:{serializedFile:'f',pathId:name}}))}},clips:Object.fromEntries(names.map(name=>[`f:${name}`,{duration:1,loop:!name.startsWith('Yeah'),curves:[{channel:'position.y',initialValue:0,keys:[{time:0,coefficients:[0,0,1,0]}]}]}])),sprites:{s:{texture:{serializedFile:'f',pathId:1},positions:[[0,0],[1,0],[0,1]],indices:[0,1,2],uvTransform:{x:10,y:20,z:10,w:30}}}}
const base={command:'Penlight',id:'1',prefab:'p',time:0,sourceRow:1,erase:false,x:10,y:20,scale:1,depth:12,speed:1,animationType:0,animationId:1,color:'#ff0000'}
const unit={...base,command:'Penlight_unit_color',time:100,sourceRow:2,colorMode:2,colors:['#IdolColor1','#00ff00']}
const registration={seed:'fixed',idolColors:['#ffffff']}
assert.deepEqual(penlightColor('#12345680'),[18/255,52/255,86/255,128/255])
assert.equal(penlightColor('#IdolColor2',registration.idolColors),null)
let state=penlightsAt([base],0,model)[0]
assert.equal(state.clipName,'Beat1','Native SafeGet clamps family zero')
assert.ok(state.phases.every(x=>x>=0&&x<.1))
assert.deepEqual(state.colors,Array(3).fill([1,0,0,1]))
state=penlightsAt([base,unit],100,model,registration)[0]
assert.deepEqual(state.colors,[[1,1,1,1],[1,1,1,1],[0,1,0,1]])
const moving=structuredClone(model)
for(const a of moving.prefabs[0].actors) {
  a.controllerKey=`c${a.index}`
  moving.controllers[a.controllerKey]={states:names.map(name=>({name,stateSpeed:1,clip:{serializedFile:'f',pathId:`${name}-${a.index}`}}))}
  for(const name of names)moving.clips[`f:${name}-${a.index}`]={duration:1,loop:true,curves:[{channel:'position.x',initialValue:name.startsWith('Beat')?10-a.index*10:a.index*10,keys:[]}]}
}
const incoming=penlightsAt([base,unit],100,moving,registration)[0]
assert.deepEqual(incoming.colors,[[0,1,0,1],[1,1,1,1],[1,1,1,1]],'Mode 2 sorts the incoming animated pose, not serialized X')
const flipped=penlightsAt([base,{...unit,scale:-1}],100,moving,registration)[0]
assert.deepEqual(flipped.colors,[[1,1,1,1],[1,1,1,1],[0,1,0,1]],'Signed root scale is included before world-X sorting')
const collapsed=penlightsAt([base,{...unit,scale:0}],100,moving,registration)[0]
assert.deepEqual(collapsed.colors,[[1,1,1,1],[1,1,1,1],[0,1,0,1]],'Collapsed root scale preserves serialized renderer order for tied X')
const sameTime=penlightsAt([base,{...unit,animationType:2},{...unit,sourceRow:3,colors:['#ff0000','#0000ff']}],100,moving,registration)[0]
assert.deepEqual(sameTime.colors,[[0,0,1,1],[1,0,0,1],[1,0,0,1]],'Same-clock commands retain incoming pose despite intervening Play requests')
const erase={command:'Penlight',id:'1',prefab:'p',time:200,sourceRow:3,erase:true}
const reset=penlightsAt([base,unit,erase],200,model,registration)[0]
assert.deepEqual(reset.colors,Array(3).fill([0,0,1,1]))
assert.equal(reset.time,100);assert.equal(reset.depth,12);assert.equal(reset.x,10)
const cached=penlightsAt([base,unit,erase,{...unit,time:300,sourceRow:4}],300,model,registration)[0]
assert.deepEqual(cached.colors,reset.colors,'ResetColor preserves native palette cache')
const randomEvents=[{...base,animationId:0}]
const sampler=createPenlightSampler(randomEvents,model,registration)
const first=sampler(0)
assert.equal(sampler(500),first)
sampler(-1);assert.deepEqual(sampler(0),first,'Backward seek repeats the same preview random choices')
const actor=first[0].prefab.actors[0]
assert.ok(Math.abs(penlightActorMatrix(actor,first[0],500).ty-first[0].phases[0]-.5)<1e-6)
const rotated=structuredClone(model)
rotated.clips['f:Beat1'].curves.push({channel:'eulerDegrees.z',initialValue:90,keys:[]},{channel:'eulerDegrees.x',initialValue:0,keys:[]})
const rotationState=penlightsAt([base],0,rotated)[0]
const rotation=penlightActorMatrix(rotationState.prefab.actors[0],rotationState,0)
assert.ok(Math.abs(rotation.a)<1e-6 && Math.abs(rotation.b-1)<1e-6,'Native Euler Z curve rotates the tight mesh')
const mesh=penlightMeshInput(model.sprites.s,{width:100,height:100})
assert.deepEqual([...mesh.indices],[0,1,2]);assert.ok(Math.abs(mesh.uvs[1]-.7)<1e-6)

let geometries=0,materials=0,meshes=0
class Geometry {constructor(){geometries++}destroy(){geometries--}}
class Material {constructor(texture){this.texture=texture;materials++}destroy(){materials--}}
class Mesh {constructor(g,m){this.geometry=g;this.shader=m;meshes++;this.transform={setFromMatrix(){}}}removeFromParent(){}destroy(){meshes--}}
class Matrix {set(){}}
const PIXI={MeshGeometry:Geometry,MeshMaterial:Material,Mesh,Matrix}
const texture={width:100,height:100,destroy(){throw Error('Borrowed texture destroyed')}}
const runtime=createPenlightRuntime(PIXI,model,'p',new Map([['f:1',texture]]),{addChild(){}})
assert.equal(geometries,1);assert.equal(materials,4)
assert.equal(applyPenlightRuntime(runtime,first[0],500,960,540),4)
assert.deepEqual(runtime.draws.map(d=>d.mesh.zIndex),[12,12,12,8])
releasePenlightRuntime(runtime);releasePenlightRuntime(runtime)
assert.equal(geometries+materials+meshes,0)
assert.throws(()=>createPenlightRuntime({...PIXI,Mesh:class{constructor(){throw Error('allocation')}}},model,'p',new Map([['f:1',texture]]),{}),/allocation/)
assert.equal(geometries+materials+meshes,0,'Partial allocation releases private GPU resources')

const hash=x=>createHash('sha256').update(x).digest('hex')
const commands=JSON.parse(readFileSync(new URL('../public/data/stage-penlight-commands.json',import.meta.url)))
const loaderSource=readFileSync(new URL('../src/utils/liveChibiSpine.js',import.meta.url),'utf8').match(/export async function fetchLiveChibiPenlights\([^]*?\n\}/)[0]
const makeLoader=new Function('indexTransport','LIVE_CHIBI_BASE','validatePenlightData','crypto',loaderSource.replace('export async function','async function')+';return fetchLiveChibiPenlights')
const modelText=JSON.stringify(model),choreographyText='{}'
const fixture={...commands,modelSha256:hash(modelText),choreographyIndexSha256:hash(choreographyText)}
const loader=makeLoader({async load(url){return url.startsWith('/data/')?JSON.stringify(fixture):url.includes('/penlight/')?modelText:choreographyText}},'/assets/live-chibi',validatePenlightData,globalThis.crypto)
assert.equal((await loader('choreography/index.json')).commands.eventCount,6697)
const abort=new AbortController();abort.abort()
await assert.rejects(loader('choreography/index.json',{signal:abort.signal}),{name:'AbortError'})
await assert.rejects(makeLoader({async load(){throw Error('HTTP 404')}},'',validatePenlightData,globalThis.crypto)('index.json'),/404/)
// The model is part of the local source corpus, not portable verifier input.
if(process.argv.includes('--published-assets')) {
  const choreography=readFileSync(new URL('../public/assets/live-chibi/choreography/index.json',import.meta.url))
  const raw=readFileSync(new URL('../public/assets/live-chibi/penlight/index.json',import.meta.url))
  const publishedModel=JSON.parse(raw)
  validatePenlightData(commands,hash(choreography),hash(raw))
  assert.equal(commands.eventCount,6697);assert.equal(Object.keys(commands.songs).length,118)
  assert.equal(Object.keys(commands.idolColors).length,49)
  for(const track of Object.values(commands.songs)) {
    const states=penlightsAt(track.events,Infinity,publishedModel,{nativeIdolType:track.nativeIdolType,idolColors:Object.values(commands.idolColors).slice(0,5)})
    assert.ok(states.length>0)
    for(const s of states)for(const a of s.prefab.actors)assert.ok(Object.values(penlightActorMatrix(a,s,s.time)).every(Number.isFinite))
  }
}
assert.throws(()=>validatePenlightData(commands,'a'.repeat(64),'b'.repeat(64)),/do not match/)
console.log('PASS Penlight: native family/phase/color/cache/erase/seek, tight UV mesh, renderer ownership'+(process.argv.includes('--published-assets')?', 6697 real events / 118 arrangements':''))
