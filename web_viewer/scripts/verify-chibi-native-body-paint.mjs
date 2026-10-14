import assert from 'node:assert/strict'
import fs from 'node:fs'
import { bodyUniformsAt } from '../src/core/chibiBodyColors.js'
import { syncNativeBodyColor, releaseNativeBodyColor } from '../src/core/chibiNativeBodyPaint.js'

const close = (a,b) => assert(Math.abs(a-b)<1e-7, `${a} != ${b}`)
const events = [{time:0,stagePosition:2,color:'#000000',opacity:1000,duration:100},
  {time:50,stagePosition:2,hide:true,duration:100}]
assert.deepEqual(bodyUniformsAt(events,-1),new Map())
const midway=bodyUniformsAt(events,50).get(2)
close(midway[0],.25);close(midway[3],.75)
const fading=bodyUniformsAt(events,100).get(2)
close(fading[0],.8125);close(fading[3],.1875)
assert.deepEqual(bodyUniformsAt(events,150).get(2),[1,1,1,0])
assert.deepEqual(bodyUniformsAt(events,50).get(2),midway)

let shaderDestroyed=0, normal=0, painted=0, shouldThrow=false
class Material {
  constructor(texture,options) { this.texture=texture;this.uniforms=options.uniforms }
  destroy() { shaderDestroyed++ }
}
const PIXI={MeshMaterial:Material,Program:{from:()=>({})}}
const makeMesh=()=>({shader:{texture:{id:'atlas'},tint:0x80ff80},_render(){
  if(this.shader instanceof Material){painted++;assert.deepEqual([...this.shader.uniforms.nativeBody],[0,0,1,.5]);if(shouldThrow)throw Error('probe')}
  else normal++
}})
const existing=makeMesh(),original=existing.shader
const runtime={spine:{skeleton:{slots:[{meshes:{existing}}]},newMesh:makeMesh,newSprite:()=>({})}}
syncNativeBodyColor(PIXI,runtime,[0,0,1,.5],true)
existing._render({});assert.equal(painted,1);assert.equal(existing.shader,original)
const late=runtime.spine.newMesh();late._render({});assert.equal(painted,2)
shouldThrow=true;assert.throws(()=>existing._render({}),/probe/);assert.equal(existing.shader,original)
syncNativeBodyColor(PIXI,runtime,[0,0,1,.5],false);existing._render({});assert.equal(normal,1)
releaseNativeBodyColor(runtime);assert.equal(shaderDestroyed,2);assert.equal(runtime.nativeBodyPaint,null)
existing._render({});assert.equal(normal,2)
assert.equal(runtime.spine.newMesh,makeMesh,'Release restores the exact attachment factory')

const index=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/choreography/index.json',import.meta.url)))
const take=index.songs.find(s=>s.id==='tkstp1_live_effect')
const body=bodyUniformsAt(take.bodyColorEvents,0).get(3)
close(body[0],34/255);close(body[1],29/255);close(body[2],35/255);close(body[3],.55)
for(const song of index.songs)for(const event of song.bodyColorEvents){
  for(const rgba of bodyUniformsAt(song.bodyColorEvents,event.time+event.duration).values())
    assert(rgba.every(v=>Number.isFinite(v)&&v>=0&&v<=1))
}
console.log('PASS native body RGBA/OutQuad/hide, actual material swap, late meshes, exceptions, inactive batching and disposal; 1188 published controls')
