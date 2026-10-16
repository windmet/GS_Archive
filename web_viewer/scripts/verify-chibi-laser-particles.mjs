import assert from 'node:assert/strict'
import fs from 'node:fs'
import { integrateLaserCurve, sampleLaserParticles, laserParticleLayout } from '../src/core/chibiLaserParticles.js'
const model = JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-laser-model.json',import.meta.url)))
const state = { eventTime:1800,style:7,sweepDuration:1500,angle:0,direction:'right',length:1300,x:-648,y:298,color:'#ffccff',width:300,alpha:1 }
assert.equal(sampleLaserParticles(model.styles[7],state,1799).length,0)
const early = sampleLaserParticles(model.styles[7],state,3000)
const later = sampleLaserParticles(model.styles[7],state,4000)
assert(early.length>=16 && later.length>early.length)
assert(new Set(later.map(p=>p.rotation.toFixed(3))).size>=6)
assert(later.every(p=>p.alpha>=0 && p.alpha<=1 && p.asset==='laserlight_3'))
assert(later.some(p=>p.width>100 && p.alpha<.24)) // Separate native low-alpha glow emitter.
assert.deepEqual(sampleLaserParticles(model.styles[7],state,3000),early) // Backward seek after later sample.
const origin = laserParticleLayout(state,1280,720)
assert.deepEqual(origin,{x:-8,y:422,fit:1})
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
assert.ok([...material.uniforms.uColor].every(x=>x===1),'APK additive vertex shader clamps COLOR0 before texture multiplication')
material.tint=0x211ea1;updateSpriteLaserMaterial.call(material)
assert.ok(Math.abs(material.uniforms.uColor[2]-161/255)<1e-7)
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
class Mesh {constructor(texture,vertices,uvs,indices){Object.assign(this,{texture,vertices,uvs,indices,shader:{program:{vertexSrc:'mock'}},transform:{setFromMatrix(m){this.matrix=m}}})}}
class Container {constructor(){this.children=[];this.position={set(...v){this.value=v}};this.scale={set(...v){this.value=v}}}addChild(...x){this.children.push(...x)}}
class Matrix {constructor(a,b,c,d,tx,ty){Object.assign(this,{a,b,c,d,tx,ty})}}
class Material {constructor(texture,options){this.texture=texture;this.program=options.program;this.uniforms={...options.uniforms,uColor:new Float32Array(4)}}}
const pixi={SimpleMesh:Mesh,MeshMaterial:Material,Program:{from:(v,f)=>({vertexSrc:v,fragmentSrc:f})},Container,Matrix,BLEND_MODES:{ADD:1,ADD_NPM:16}}
const runtime=createSpriteLaserRuntime(pixi,new Container(),spriteLaserModel.layers,Array(3).fill({width:512,height:512}))
assert.equal(runtime.sprites.length,3)
assert.ok(runtime.sprites.every(s=>s.shader.batchable===false&&s.blendMode===16))
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

const {laserSimulationClock,laserBillboardPlane,nativeLaserScale,nativeLaserAlpha,nativeLaserGeometry}=await import('../src/core/chibiLaserGeometry.js')
const fixtures=Object.fromEntries(['laser','spotbeam','turnlaser'].map(kind=>[kind,JSON.parse(fs.readFileSync(new URL(`./fixtures/chibi-${kind}-native.json`,import.meta.url),'utf8'))]))
const models=Object.fromEntries(['laser','spotbeam','turnlaser'].map(kind=>[kind,JSON.parse(fs.readFileSync(new URL(`./fixtures/chibi-${kind}-model.json`,import.meta.url),'utf8'))]))
// Independent 3D quaternion-vector oracle from the original APK hierarchy.
// The production path composes 2D affine matrices; this walks source nodes
// in reverse and retains Z while rotating each corner.
const rotateQ=(v,q)=>{
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
 const c=cross([q.x,q.y,q.z],v),cc=cross([q.x,q.y,q.z],c)
 return v.map((x,i)=>x+2*(q.w*c[i]+cc[i]))
}
const polynomial=(curve,t)=>{let k;for(const key of curve.keys)if(key.time<=t)k=key;return k?((k.coefficients[0]*(t-k.time)+k.coefficients[1])*(t-k.time)+k.coefficients[2])*(t-k.time)+k.coefficients[3]:curve.initialValue}
let planes=0,corners=0
for(const [kind,fixture] of Object.entries(fixtures)) for(const prefab of fixture.prefabs) {
 const native=models[kind].styles[prefab.style]
 for(const raw of prefab.systems) {
  const system=native.systems.find(s=>String(s.source.pathId)===String(raw.pathId));assert(system)
  planes++
  for(const direction of ['left','right']) for(const wall of [.1,1,3.2,6.3]) {
   const command={style:prefab.style,eventTime:1000,sweepDuration:6000,angle:37,direction,length:1300,width:1200,alpha:1}
   const phase=wall*Math.fround(native.defaultDuration/6)
   const theta=system.animation?polynomial(system.animation.curve,phase*system.animation.speed%system.animation.duration)*Math.PI/180:0
   const particleAngle=.7
   const actual=laserBillboardPlane(system,native,command,1000+wall*1000,particleAngle)
   const clock=laserSimulationClock(system,command,1000+wall*1000)
   assert.equal(clock.elapsed,wall*Math.fround(raw.main.lengthInSec/6),'Each emitter uses its own duration')
   for(const point of [[0,0],[-.4,-.8],[.4,.2]]) {
    let v=rotateQ([point[0],point[1],0],{x:0,y:0,z:Math.sin(-particleAngle/2),w:Math.cos(-particleAngle/2)})
    for(const [index,tr] of raw.transformChain.entries()) {
     v=v.map((x,i)=>x*tr.scale[['x','y','z'][i]])
     const q=system.animation&&index===0?{x:0,y:0,z:Math.sin(theta/2),w:Math.cos(theta/2)}:tr.rotation
     v=rotateQ(v,q)
     if(index<raw.transformChain.length-1)v=v.map((x,i)=>x+tr.position[['x','y','z'][i]])
    }
    if(direction==='left')v=rotateQ(v,{x:1,y:0,z:0,w:0})
    v=rotateQ(v,{x:0,y:0,z:Math.sin(37*Math.PI/360),w:Math.cos(37*Math.PI/360)})
    const x=actual.a*point[0]+actual.c*(-point[1])+actual.x/100
    const y=actual.b*point[0]+actual.d*(-point[1])+actual.y/100
    assert.ok(Math.abs(x-v[0])<1e-6 && Math.abs(y+v[1])<1e-6,`${kind}/${prefab.style}/${raw.pathId} quaternion plane`)
    corners++
   }
  }
 }
}
assert.equal(planes,60);assert.equal(Object.keys(nativeLaserGeometry.systems).length,60)
assert.equal(corners,1440)
const command={length:1000,width:500,alpha:1}
assert.deepEqual(nativeLaserScale(command),{x:1,y:1})
assert.deepEqual(nativeLaserScale({...command,width:1200}),{x:1,y:1},'Alpha never scales a beam')
assert.equal(nativeLaserAlpha(command),.5)
assert.equal(nativeLaserAlpha({...command,width:1200}),1,'Particle Color32 bounds alpha at birth')
assert.deepEqual(nativeLaserScale({...command,length:500}),{x:.5,y:.5})
assert.throws(()=>laserBillboardPlane({...models.laser.styles[3].systems[0],source:{pathId:'missing'}},models.laser.styles[3],{style:3},0,0),/Unbound/)
console.log(`PASS ${planes} source billboard planes / ${corners} independent quaternion corners, per-system clocks, alpha/scale separation and unknown binding rejection`)

const {sampleSpotbeamParticles}=await import('../src/core/chibiSpotbeamParticles.js')
const corpus=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/choreography/index.json',import.meta.url),'utf8'))
let rows=0,hdr=0
for(const song of corpus.songs) for(const event of song.laserlightEvents||[]) {
 if(event.hide||event.style===1)continue
 const native=models.laser.styles[event.style]||models.spotbeam.styles[event.style]||models.turnlaser.styles[event.style]
 assert.ok(native,`Native model missing for ${song.id}/${event.style}`)
 assert.ok(event.sweepDuration>0&&event.color)
 const state={...event,eventTime:event.time,alpha:1}
 rows++;if(event.width>1000)hdr++
 const sample=native.kind==='spotbeam'?sampleSpotbeamParticles:sampleLaserParticles
 for(const dt of [100,1000,3100]) for(const particle of sample(native,state,event.time+dt)) {
  assert.ok(particle.width>0&&particle.length>0&&Number.isFinite(particle.alpha))
  for(const k of ['a','b','c','d','x','y'])assert.ok(Number.isFinite(particle.matrix[k]))
 }
 assert.deepEqual(sample(native,state,event.time+100),sample(native,state,event.time+100),'Stateless source replay')
}
assert.equal(rows,1083);assert.equal(hdr,118)
console.log(`PASS ${rows} published particle commands (${hdr} alpha>1), model binding, source clocks, finite geometry and replay`)

// K.now O.nly uses the same style3 prefab as other songs. Exercise actual
// Show/Erase ordering and rewind through the production state reducer.
const know=corpus.songs.find(s=>s.id==='knwonl_live_effect')
assert.equal(know.laserlightEvents.filter(e=>!e.hide).length,72)
assert.deepEqual([...new Set(know.laserlightEvents.filter(e=>!e.hide).map(e=>e.style))],[3])
song.value=know
const witnesses=[
 [1800,[1,2,3,4],4], [2500,[1,2,3,4,5,6,7,8],8],
 [3600,[10,11,12,13],0], [30000,[],0],
 [86000,[30,31,32,33,34,35,36,37],8], [87850,[],0],
 [2500,[1,2,3,4,5,6,7,8],8],
]
for(const [time,ids,count] of witnesses){
 const states=[...sample(time).values()]
 assert.deepEqual([...sample(time).keys()],ids)
 const particles=states.flatMap(state=>sampleLaserParticles(models.laser.styles[state.style],state,time))
 assert.equal(particles.filter(p=>p.alpha>.001).length,count)
 for(const state of states){
  assert.deepEqual(nativeLaserScale(state),{x:Math.fround(.8),y:Math.fround(.8)})
  assert.equal(nativeLaserAlpha(state),Math.fround(.6))
 }
}
assert.ok(!samplerSection.includes('songCode'),'Laser state reduction must depend on source events')
console.log('PASS K.now O.nly: 72 native style3 shows, shared state/plane/scale/alpha, erase boundaries, gap and rewind')

material.alpha=.5;updateSpriteLaserMaterial.call(material)
assert.ok(Math.abs(material.uniforms.uColor[2]-161/255)<1e-7,'Source alpha is applied by native SrcAlpha blend, not twice in RGB')
assert.equal(material.uniforms.uColor[3],.5)
console.log('PASS native Shader950 clamp, straight texture colour and SrcAlpha/One RGB+alpha blend contract')
