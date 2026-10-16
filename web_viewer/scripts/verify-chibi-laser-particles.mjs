import assert from 'node:assert/strict'
import fs from 'node:fs'
import { integrateLaserCurve, sampleLaserParticles, laserParticleLayout } from '../src/core/chibiLaserParticles.js'
const model = JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-laser-model.json',import.meta.url)))
const state = { eventTime:1800,style:7,sweepDuration:1500,angle:0,length:1300,x:-648,y:298,color:'#ffccff',width:300,alpha:1 }
assert.equal(sampleLaserParticles(model.styles[7],state,1799).length,0)
const early = sampleLaserParticles(model.styles[7],state,3000)
const later = sampleLaserParticles(model.styles[7],state,4000)
assert(early.length>=16 && later.length>early.length)
assert(new Set(later.map(p=>p.rotation.toFixed(3))).size>=6)
assert(later.every(p=>p.alpha>=0 && p.alpha<=1 && p.asset==='laserlight_3'))
assert(later.some(p=>p.width>100 && p.alpha<.24)) // Separate native low-alpha glow emitter.
assert.deepEqual(sampleLaserParticles(model.styles[7],state,3000),early) // Backward seek after later sample.
const origin = laserParticleLayout(state,1280,720)
assert.deepEqual(origin,{x:1288,y:422,fit:1})
assert.equal(laserParticleLayout(state,640,360).x,origin.x/2)
// The emitter stays fixed; particles' angles change independently.
assert.deepEqual(laserParticleLayout(state,1280,720),origin)
const zero = {mode:0,scalar:2,keys:[]}
assert.equal(integrateLaserCurve(zero,.5),1)
const linear = {mode:1,scalar:1,keys:[{time:0,value:1,outSlope:-1},{time:1,value:0,inSlope:-1}]}
assert(Math.abs(integrateLaserCurve(linear,1)-.5)<1e-12)
const red = {...state,style:3,eventTime:1750,sweepDuration:1200,angle:280,color:'#dc291e',width:600,length:800}
const burst = sampleLaserParticles(model.styles[3],red,1800)
assert(burst.length>0 && burst.every(p=>p.color===0xdc291e)) // No artificial white line core.
assert(sampleLaserParticles(model.styles[3],red,2500).length===0) // Authored gap between flickers.
if(process.argv.includes('--published-assets')) {
  const index=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/stage-effects/index.json',import.meta.url)))
  assert.deepEqual(index.laserlight,model)
  assert.equal(index.assets.laserlight_3.source.pathId,'885')
}
console.log('PASS laser particles: fixed origins, burst fan angles, soft native glow, tint, flicker gaps, seek, scale')

const {sampleSpriteLaser,spriteLaserModel,createSpriteLaserRuntime,applySpriteLaserRuntime,updateSpriteLaserMaterial}=await import('../src/core/chibiSpriteLaser.js')
const material={texture:{baseTexture:{alphaMode:1}},tint:0xffffff,alpha:1.2,
 uniforms:{uColor:new Float32Array(4)},uvMatrix:{update:()=>false}}
updateSpriteLaserMaterial.call(material)
assert.ok([...material.uniforms.uColor].every(x=>Math.abs(x-1.2)<1e-7),'Native float RGBA must survive both Sprite batching and MeshMaterial color clamps')
material.tint=0x211ea1;updateSpriteLaserMaterial.call(material)
assert.ok(Math.abs(material.uniforms.uColor[2]-161/255*1.2)<1e-7)
const spriteState={eventTime:26550,style:1,sweepDuration:6000,angle:110,direction:'right',length:200,x:504,y:256,color:'#211EA1',width:1200,depth:1651,alpha:1}
// Independent point-wise parent transforms, using quaternion components and
// the clip's known smooth 0->60->0 polynomial. Do not reuse runtime matrices.
for(const direction of ['left','right']) for(const elapsed of [0,250,1500,3000,4500,5999,6000,9000]) {
 const t=elapsed/1000*Math.fround(2/6)%2,u=t<=1?t:t-1
 const theta=(t<=1?60*(3*u*u-2*u*u*u):60*(1-3*u*u+2*u*u*u))*Math.PI/180
 const actual=sampleSpriteLaser({...spriteState,direction},26550+elapsed)
 for(const [index,layer] of spriteLaserModel.layers.entries()) for(const [px,py] of [[-256,0],[256,-512],[0,-256]]) {
  let x=px/100,y=-py/100
  for(let j=layer.chain.length-1;j>=0;j--){
   const tr=layer.chain[j],q=tr.rotation
   const c=j===layer.animationIndex?Math.cos(theta):1-2*q.z*q.z
   const s=j===layer.animationIndex?Math.sin(theta):2*q.w*q.z
   const xx=x*tr.scale.x,yy=y*tr.scale.y
   x=c*xx-s*yy+tr.position.x;y=s*xx+c*yy+tr.position.y
  }
  if(direction!=='right')y=-y
  const a=110*Math.PI/180,c=Math.cos(a),s=Math.sin(a),xx=x*c-y*s,yy=x*s+y*c
  const m=actual[index]
  assert.ok(Math.abs(m.a*px+m.c*py+m.tx-xx*100)<0.001)
  assert.ok(Math.abs(m.b*px+m.d*py+m.ty+yy*100)<0.001)
 }
}
class Mesh {constructor(texture,vertices,uvs,indices){Object.assign(this,{texture,vertices,uvs,indices,shader:{},transform:{setFromMatrix(m){this.matrix=m}}})}}
class Container {constructor(){this.children=[];this.position={set(...v){this.value=v}};this.scale={set(...v){this.value=v}}}addChild(...x){this.children.push(...x)}}
class Matrix {constructor(a,b,c,d,tx,ty){Object.assign(this,{a,b,c,d,tx,ty})}}
const pixi={SimpleMesh:Mesh,Container,Matrix,BLEND_MODES:{ADD:1}}
const runtime=createSpriteLaserRuntime(pixi,new Container(),spriteLaserModel.layers,Array(3).fill({width:512,height:512}))
assert.equal(runtime.sprites.length,3)
assert.ok(runtime.sprites.every(s=>s.shader.batchable===false))
assert.equal(applySpriteLaserRuntime(pixi,runtime,spriteState,28000,1280,720),3)
assert.deepEqual(runtime.container.position.value,[1144,464],'Native effect X follows ScriptPosToStagePos')
assert.ok(Math.abs(runtime.container.scale.value[0]-.2)<1e-7)
assert.ok(runtime.sprites.every(s=>s.alpha>1&&s.tint===0x211ea1),'value10 is alpha; no width or white core')
const source=fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
const samplerSection=source.slice(source.indexOf('function laserlightStatesAt('),source.indexOf('function syncLaserlights('))
const song={value:{laserlightEvents:[{...spriteState,time:26550,id:201},{time:30000,id:201,hide:true,duration:5000}]}}
const sample=new Function('selectedSong',samplerSection+';return laserlightStatesAt')(song)
assert.equal(sample(29999).size,1)
assert.equal(sample(30000).size,0,'Native EraseEffect destroys immediately, regardless of authored eraseDuration')
assert.equal(sample(28000).size,1,'Backward seek reconstructs erased objects')
assert.ok(!source.includes('function drawLaserlight('),'Unsupported styles must not produce guessed Graphics beams')
console.log('PASS Sprite laser: independent native matrix/curve oracle, float alpha, real renderer properties, immediate erase and rewind')
