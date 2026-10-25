import assert from 'node:assert/strict'
import {
  hitEffectsConfig as cfg, sampleHitEffectFrame as hit, sampleHoldEffectFrame as hold,
  sampleAutoEvaluationFrame as auto, evaluateNativeCurve, sampleMinMax,
} from '../src/presentation/SongChartHitEffectRenderer.js'
const clone = x => structuredClone(x)
const contract = cfg.defaultContracts['14650'], ordinary={hitType:0,sourceIndex:12}
const frame=hit(ordinary,.15)
assert.equal(hit(ordinary,.15,{}).length,0,'missing source contract must not synthesize effects')
assert.equal(frame.filter(x=>x.subName==='flash').length,2,'source flash burst emits two particles')
assert.equal(frame.filter(x=>x.subName==='speedline').length,20,'source speedline burst emits twenty particles')
assert.equal(frame.filter(x=>x.nodeId===23817).length,2,'circle second burst is independently alive')
const circles=frame.filter(x=>x.textureId===339)
assert.deepEqual(circles.map(x=>x.nodeId),[26448,23264])
assert.notEqual(circles[0].frame,circles[1].frame,'authored squared/linear UV curves distinguish the two circles')
assert.ok(circles.every(x=>x.colorTint.g>x.colorTint.r),'native green ring color is passed to Canvas')
assert.equal(hit(ordinary,.71).length,0,'all authored transient emissions have expired')
function mutate(check, change, age=.15) {
  const contracts=clone(cfg.defaultContracts);change(contracts['14650'])
  check(hit(ordinary,age,contracts))
}
mutate(x=>assert.equal(x.filter(x=>x.subName==='flash').length,0),c=>{c.layers[0].bursts[0].count=0})
mutate(x=>assert.ok(x.filter(x=>x.subName==='flash').every(x=>x.w>frame.find(x=>x.subName==='flash').w)),c=>{c.layers[0].size*=2})
mutate(x=>assert.notDeepEqual(x.find(x=>x.nodeId===26448).basis,circles[0].basis),c=>{c.layers[3].transform.m_LocalScale.y=.25})
mutate(x=>assert.equal(x.find(x=>x.nodeId===26448).colorTint.r,.7),c=>{c.layers[3].modules.InitialModule.startColor.maxColor.r=.7})
mutate(x=>assert.notDeepEqual(x.find(x=>x.subName==='speedline').basis,frame.find(x=>x.subName==='speedline').basis),c=>{c.layers[8].lengthScale=20})
mutate(x=>assert.ok(x.some(x=>x.subName==='flash')),c=>{c.layers[0].lifetime=.9},.8)

for(const [type,textureId,sw,sh] of [[1,935,1024,256],[5,720,256,256],[6,346,512,512]]) {
 const sample=age=>hit({hitType:type,sourceIndex:1},age).find(x=>x.textureId===textureId)
 assert.equal(sample(.02).sw,sw);assert.equal(sample(.02).sh,sh)
 if(type===6) assert.equal(sample(.2).frame,2,'Special source curve holds cell two, rather than the previous first-cell placeholder')
 else assert.notEqual(sample(.02).frame,sample(.2).frame,'flick/P atlas advances from its authored curve')
}
assert.ok(!hit({hitType:6},.1).some(x=>x.subName==='sp-ring'),'no invented Special outer ring')
for(const [id,c] of Object.entries(cfg.defaultContracts)) {
 for(const l of c.layers) {
  assert.ok(l.nodeId && l.particleSourceSha256,'per-system source identity is retained')
  assert.ok(l.modules.InitialModule && l.modules.UVModule)
 }
 for(let i=0;i<70;i++) {
  const values=id==='32265'?hold({pathId:+id,sourceIndex:17},i/60):hit({pathId:+id,sourceIndex:17},i/60)
  for(const p of values) {
   assert.ok([p.dx,p.dy,p.w,p.h,p.alpha,...p.basis].every(Number.isFinite),'finite particle projection')
   assert.ok(p.sx>=0&&p.sy>=0&&p.sw>0&&p.sh>0)
  }
 }
}
const continuous=hold({sourceIndex:1},.5)
assert.deepEqual([29801,3698,25230,31727,18922].map(id=>continuous.filter(x=>x.nodeId===id).length),[1,1,1,10,5],'five native rate emitters, not seven synthetic orbit sprites')
const noRate=clone(cfg.defaultContracts);noRate['32265'].layers[3].rateOverTime=0
assert.equal(hold({sourceIndex:1},.5,noRate).filter(x=>x.nodeId===31727).length,0)
const noForce=clone(cfg.defaultContracts);delete noForce['32265'].layers[3].modules.ForceModule
assert.notDeepEqual(hold({sourceIndex:1},.5,noForce).find(x=>x.nodeId===31727),continuous.find(x=>x.nodeId===31727),'source force affects particle motion')
const noLimit=clone(cfg.defaultContracts);delete noLimit['32265'].layers[3].modules.ClampVelocityModule
assert.notDeepEqual(hold({sourceIndex:1},.5,noLimit).find(x=>x.nodeId===31727),continuous.find(x=>x.nodeId===31727),'source velocity limit affects particle motion')
const moving={sourceIndex:1,lane:4,startSeconds:0,knots:[{seconds:0,lane:0},{seconds:1,lane:4}]}
assert.ok(hold(moving,.5).find(x=>x.nodeId===29801).dx<0,'world-space hold particles remain at their birth lane')
assert.deepEqual(hold({sourceIndex:1},.5),continuous,'sampling later or seeking does not change deterministic birth samples')

const curve={m_Curve:[{time:0,value:0,inSlope:0,outSlope:0},{time:1,value:1,inSlope:0,outSlope:0}]}
assert.equal(evaluateNativeCurve(curve,.25),.15625,'Hermite checkpoint independent of linear interpolation')
assert.equal(sampleMinMax({minMaxState:3,minScalar:2,scalar:4},0,.25),2.5)
assert.ok(Math.abs(auto(.03).layers[0].scaleX-1.08709617718292)<1e-12,'pinned native scale/tangent checkpoint')
assert.deepEqual([auto(.03).layers[0].x,auto(.03).layers[0].y],[649,449],'Auto panel and child RectTransform positions replace judgeY-45 guess')
const animation=clone(cfg.evaluation.animation)
const alpha=animation.sourceCurves.float.find(c=>c.path==='EvaluationImage'&&c.attribute==='m_Color.a')
for(const k of alpha.curve.m_Curve) {k.value=0;k.inSlope=0;k.outSlope=0}
assert.ok(!auto(.5,animation).layers.some(l=>l.target==='EvaluationImage'),'source alpha mutation disables main Auto image')
assert.equal(auto(1.01),null)
assert.equal(auto(.03).layers.find(l=>l.target==='EvaluationEffectImage2').blendMode,'lighter','bound UI shader uses SrcAlpha/One')
console.log('Source module wiring passed: emissions, independent UV curves, color/TRS, hold rates/force/limits/world-space, deterministic samples and Auto Hermite/shader bindings. Unity GPU parity remains separate.')
