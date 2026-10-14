import assert from 'node:assert/strict'
import fs from 'node:fs'
import { oldSuspensionlightsAt,oldSuspensionlightLayout } from '../src/core/chibiOldSuspensionlights.js'
const read = name => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}`,import.meta.url)))
const model=read('chibi-old-suspension-model.json'),moon=read('chibi-old-suspension-events.json')
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`)
const row=(time,command='Suspensionlight',changes={})=>({time,command,id:1,erase:false,
 values:['1','1','1','2000','right','1000','30','10','360','#33f170','1650','3000','0','0','0'].map((v,i)=>changes[i+1]??v),extraValues:{}})
const at=(events,time,tempo=140)=>oldSuspensionlightsAt(events,time,model,{referenceProjection:'stage-rig-v1',tempo})
const basic=[row(0)]
close(at(basic,600)[0].nativeAngle,38.88)
close(at(basic,600)[0].angle,128.88)
assert.equal(at(basic,600)[0].alpha,1)
assert.equal(at(basic,600)[0].mirrorY,false)
// A mid-flight speed change preserves Animator phase; inactive reactivation resets it.
const changed=[...basic,row(500,'Suspensionlight',{4:'4000'})]
close(at(changed,500)[0].phase,.5)
close(at(changed,1000)[0].phase,.75)
assert.notEqual(at(changed,1000)[0].phase,.25)
const erase={...row(1000),erase:true,extraValues:{value101:'1',value102:'2000'}}
const exiting=[...basic,erase]
close(at(exiting,1100)[0].alpha,.25)
assert.equal(at(exiting,1200).length,0) // Fixed native 0.2s, not generic value102.
close(at([...exiting,row(1300)],1400)[0].phase,.1)
close(at([...exiting,row(1100)],1200)[0].phase,1.2) // Cancelled exit keeps the active instance.
// value2/3 are not native Animator gates. Huge periods are slow, not frozen.
const slow=[row(0,'Suspensionlight',{2:'',3:'',4:'9999999'})]
assert.equal(at(slow,1000).length,1)
assert.ok(at(slow,1000)[0].phase>0)
// _5's hue direction does not stop rotation, and hue delay never delays Animator.
const chroma=[row(0,'Suspensionlight_5',{4:'5000',7:'120',5:'left'})]
const half=at(chroma,1500)[0]
assert.equal(half.color,'#f133b4')
assert.equal(half.alpha,1)
close(half.phase,.6)
close(half.nativeAngle,38.88)
close(half.angle,21.12)
assert.equal(half.mirrorY,true)
const hueDelay=[row(0,'Suspensionlight_5',{4:'5000',13:'1000'})]
assert.equal(at(hueDelay,500)[0].color,'#33f170')
assert.ok(at(hueDelay,500)[0].nativeAngle>0)
// _2 samples BPM at Show, then cycles three colors on each completed beat.
const pulse=[row(0,'Suspensionlight_2',{12:'1',13:'#ff0000',14:'#0000ff'})]
close(at(pulse,60000/140/2)[0].alpha,.25)
assert.equal(at(pulse,60000/140+10)[0].color,'#ff0000')
assert.equal(at(pulse,2*60000/140+10)[0].color,'#0000ff')
assert.equal(at(pulse,3*60000/140+10)[0].color,'#33f170')
assert.equal(at(pulse,100,null)[0].unresolved,'tempo_unavailable')
assert.equal(at(pulse,100,null)[0].alpha,0)
const waitingPulse=[row(0,'Suspensionlight_2',{12:'0',15:'1'})]
assert.equal(at(waitingPulse,100)[0].alpha,0)
close(at(waitingPulse,2*60000/140+60000/140/2)[0].alpha,.25)
const delayedPulse=[row(0,'Suspensionlight_3',{12:'1000',13:'500',14:'500'})]
assert.equal(at(delayedPulse,400)[0].alpha,0)
close(at(delayedPulse,750)[0].alpha,.5)
close(at(delayedPulse,1250)[0].alpha,.5)
assert.equal(at(delayedPulse,1750)[0].alpha,0)
assert.deepEqual(at(changed,600),at(changed,600))
// Independent matrix oracle: root Rz * LeftRightBase Rx * fixed Rz60 *
// Animator Rz(a), with texture/screen Y reflection. Check corners, not angles
// alone, so a wrong reflection cannot pass by matching a beam's centre ray.
const rotate=(x,y,a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)]
for(const side of ['left','right'])for(const angle of [-120,0,73,300])for(const t of [0,300,600,1700]){
 const s=at([row(0,'Suspensionlight',{5:side,7:String(angle)})],t)[0]
 const layout=oldSuspensionlightLayout(s,1280,720)
 for(const [x,y] of [[-1,0],[1,0],[-1,3],[1,3]]){
  let p=rotate(x,-y,(60+s.nativeAngle)*Math.PI/180)
  if(side==='left')p[1]=-p[1]
  p=rotate(...p,angle*Math.PI/180);p[1]=-p[1]
  const actual=rotate(x*layout.scaleX,y*layout.scaleY,layout.rotation)
  close(actual[0],p[0]);close(actual[1],p[1])
 }
}
const beam=at(basic,600)[0],large=oldSuspensionlightLayout(beam,1280,720),small=oldSuspensionlightLayout(beam,640,360)
close(large.x,small.x*2);close(large.y,small.y*2);close(large.scaleY,small.scaleY*2)
for(const t of [0,6000,20000,105100])for(const s of at(moon,t))for(const key of ['alpha','angle','scaleX','scaleY'])assert.ok(Number.isFinite(s[key]))
if(process.argv.includes('--published-assets')){
 const base=new URL('../public/assets/live-chibi/',import.meta.url)
 const index=JSON.parse(fs.readFileSync(new URL('stage-effects/index.json',base)))
 assert.equal(Object.keys(index.oldSuspensionlightSongs).length,105)
 let count=0,driveVariants=0
 for(const [id,descriptor] of Object.entries(index.oldSuspensionlightSongs)){
  const events=JSON.parse(fs.readFileSync(new URL(descriptor.file,base))).events;count+=events.length
  if(id.startsWith('drvalv_live_effect')){
   driveVariants++
   const state=t=>at(events,t)
   assert.equal(state(19000).find(s=>s.key==='Suspensionlight_5:1').color,'#f133b4')
   close(state(19000).find(s=>s.key==='Suspensionlight_5:1').phase,.6)
   assert.ok(!state(28385).some(s=>s.key==='Suspensionlight:1'))
   const before=state(19999).find(s=>s.key==='Suspensionlight:1'),after=state(20000).find(s=>s.key==='Suspensionlight:1')
   assert.ok(after.phase>=before.phase && after.phase-before.phase<.000001)
  }
  for(const t of [6000,19000,28385,112900])for(const s of at(events,t))for(const k of ['alpha','angle','scaleX','scaleY'])assert.ok(Number.isFinite(s[k]),`${id} ${s.key} ${k}`)
 }
 assert.equal(count,88647);assert.equal(driveVariants,20)
}
console.log('PASS old suspension: native hue/BPM/linear pulse, fixed erase, active phase continuity, slow periods, independent hierarchy matrix, seek and corpus')
