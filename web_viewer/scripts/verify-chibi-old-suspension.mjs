import assert from 'node:assert/strict'
import fs from 'node:fs'
import { oldSuspensionlightsAt,oldSuspensionlightLayout } from '../src/core/chibiOldSuspensionlights.js'
const json=name=>JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}`,import.meta.url)))
const events=json('chibi-old-suspension-events.json'),model=json('chibi-old-suspension-model.json')
const at=t=>oldSuspensionlightsAt(events,t,model)
assert.equal(events.length,224)
assert.equal(at(0).length,8,'Base sidelight commands share the native sprite/curve interface')
const early=at(6000),later=at(6300)
assert.equal(early.length,18)
assert.equal(early.find(s=>s.key==='Suspensionlight_2:301').angle,later.find(s=>s.key==='Suspensionlight_2:301').angle,'A huge-period fade lamp must not inherit a looping rotation curve')
assert.deepEqual(at(6000),early,'Backward seek resets all later generations')
assert.deepEqual(at(6300),later,'Paused frame is deterministic')
assert.ok(!at(20000).some(s=>s.key==='Suspensionlight_2:301'),'Distant erase flags remove the building beam')
const beam=early.find(s=>s.key==='Suspensionlight_2:301')
const wide=oldSuspensionlightLayout(beam,1280,720),small=oldSuspensionlightLayout(beam,640,360)
assert.equal(wide.x,small.x*2);assert.equal(wide.y,small.y*2)
assert.equal(wide.scaleY,1,'The earlier Moon extent calibration remains separate')
assert.equal(wide.y,384,'Building beam is behind the platform, rather than at its front edge')
const ceiling=at(20000).filter(s=>s.key.startsWith('Suspensionlight_3:') && s.y===1600)
assert.ok(ceiling.every(s=>!s.moving),'Huge rotation periods keep ceiling lamps still while brightness offsets pulse')
const cycle=[0,500,1000,1500].flatMap(dt=>at(20000+dt).filter(s=>s.key==='Suspensionlight_3:3').map(s=>s.angle))
assert.ok(cycle.every(a=>a===0),'Brightness animation must not force a held lamp to rotate')
const pair=at(105100).filter(s=>['Suspensionlight_5:201','Suspensionlight_5:202'].includes(s.key))
assert.equal(pair.length,2)
const rotations=pair.map(s=>oldSuspensionlightLayout(s,1280,720).rotation)
assert.ok(rotations.every(r=>Math.cos(r)<0),'Floor-mounted beams rise from their sources')
assert.ok(Math.sin(rotations[0])*Math.sin(rotations[1])<0,'Complementary mounting angles and mirrored excursions fan toward opposite sides')
const bad=structuredClone(events);bad.find(e=>`${e.command}:${e.id}`===early[0].key).values[4]='unknown'
assert.ok(!oldSuspensionlightsAt(bad,6000,model).some(s=>s.key===early[0].key))
if(process.argv.includes('--published-assets')) {
 const index=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/stage-effects/index.json',import.meta.url)))
 assert.deepEqual(index.oldSuspensionlight,model)
 assert.equal(Object.keys(index.oldSuspensionlightSongs).length,105)
 const enabled=Object.entries(index.oldSuspensionlightSongs).filter(([,s])=>s.previewEnabled).map(([id])=>id)
 assert.equal(enabled.length,42)
 assert.ok(enabled.every(id=>id==='montns_live_effect'||id.startsWith('grwsml_live_effect')||id.startsWith('drvalv_live_effect')))
 assert.equal(index.oldSuspensionlightSongs.montns_live_effect.eventCount,1840)
 const drive=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/stage-effects/old-suspension/drvalv_live_effect.json',import.meta.url))).events
 const registration=index.oldSuspensionlightSongs.drvalv_live_effect
 const opening=oldSuspensionlightsAt(drive,8000,model,registration)
 assert.equal(opening.length,10)
 assert.ok(opening.every(s=>s.angle===0 && !s.moving),'Opening blue lamps are vertical, with no Animator excursion')
 for (const time of [0,1000,5000,8100,12000,16000]) {
   const frame=oldSuspensionlightsAt(drive,time,model,registration).filter(s=>s.key.startsWith('Suspensionlight:'))
   assert.equal(frame.length,10)
   assert.ok(frame.every(s=>s.angle===0 && !s.moving))
   assert.deepEqual(frame.map(s=>[s.x,s.y]),opening.map(s=>[s.x,s.y]),'Fixed blue sources remain stationary')
 }
 const sides=oldSuspensionlightsAt(drive,12500,model,registration).filter(s=>s.key.startsWith('Suspensionlight_2:'))
 assert.equal(sides.length,8)
 const yellow=t=>oldSuspensionlightsAt(drive,t,model,registration).filter(s=>s.key.startsWith('Suspensionlight_2:'))
 for (const time of [10700,11700,12700]) {
   assert.deepEqual(yellow(time).map(s=>[s.x,s.y,s.angle]),sides.map(s=>[s.x,s.y,s.angle]))
   assert.ok(yellow(time).every(s=>Math.abs(s.alpha-(time===11700 ? 0 : .55))<1e-10),'Yellow fades on/off/on without changing its angle')
 }
 const green=t=>oldSuspensionlightsAt(drive,t,model,registration).filter(s=>['Suspensionlight:1','Suspensionlight:2','Suspensionlight:5','Suspensionlight:6'].includes(s.key))
 const mRig=green(18000)
 assert.equal(mRig.length,4)
 for (const time of [17100,18000,18200,19900,20000]) assert.deepEqual(green(time).map(s=>[s.key,s.x,s.y,s.angle]),mRig.map(s=>[s.key,s.x,s.y,s.angle]))
 const turning=green(21500)
 assert.ok(turning.every(s=>s.moving))
 assert.deepEqual(turning.map(s=>[s.x,s.y]),mRig.map(s=>[s.x,s.y]),'Rotation leaves every emitter fixed')
 assert.notDeepEqual(turning.map(s=>s.angle),mRig.map(s=>s.angle))
 assert.equal(green(27000).length,4,'Rotation period is not a lifetime; the explicit erase owns visibility')
 const tlMoving=turning.find(s=>s.key==='Suspensionlight:2'),flMoving=turning.find(s=>s.key==='Suspensionlight:6')
 assert.ok(tlMoving.angle<40 && flMoving.angle<-200,'Top turns towards vertical while lower lamps turn towards horizontal')
 assert.notEqual(40-tlMoving.angle,-200-flMoving.angle,'6000 / 5000 periods advance the upper and lower lights independently')
 const exitState=green(29185).find(s=>s.key==='Suspensionlight:1')
 assert.equal(exitState.alpha,.275,'value102=2000 fades the outgoing lamp over two seconds')
 assert.ok(!green(30185).some(s=>s.key==='Suspensionlight:1'))
 const segment=key=>{
   const s=mRig.find(s=>s.key===key),p=oldSuspensionlightLayout(s,1280,720)
   return { ...p,dx:-Math.sin(p.rotation),dy:Math.cos(p.rotation) }
 }
 const tl=segment('Suspensionlight:2'),tr=segment('Suspensionlight:1')
 const fl=segment('Suspensionlight:6'),fr=segment('Suspensionlight:5')
 assert.ok(tl.dy>0&&tl.dx>0&&tr.dy>0&&tr.dx<0,'Inner M segments descend towards the centre')
 assert.ok(fl.dy<0&&fl.dx>0&&fr.dy<0&&fr.dx<0,'Outer M segments rise towards the upper left/right vertices')
 const xAtY=(p,y)=>p.x+(y-p.y)/p.dy*p.dx
 assert.ok(tl.y<0 && tr.y<0 && fl.x<60 && fr.x>1220,'Native M vertices remain above the frame and outer sources at its edges')
 assert.ok(Math.abs(xAtY(fl,tl.y)-tl.x)<44 && Math.abs(xAtY(fr,tr.y)-tr.x)<44,'Outer segments meet the native upper mounting vertices')
 assert.ok(Math.abs(xAtY(tl,fl.y)-640)<10 && Math.abs(xAtY(tr,fr.y)-640)<10,'Inner segments meet at the stage centre')
 for (const id of enabled.filter(id=>id.startsWith('drvalv_live_effect'))) {
   const track=JSON.parse(fs.readFileSync(new URL(`../public/assets/live-chibi/${index.oldSuspensionlightSongs[id].file}`,import.meta.url))).events
   assert.ok(oldSuspensionlightsAt(track,8000,model,index.oldSuspensionlightSongs[id]).filter(s=>s.key.startsWith('Suspensionlight:')).every(s=>s.angle===0))
 }
}
console.log('PASS old sidelight generations, native curves, erase, seek/pause, responsive projection and Moon/Growing/Drive activation guard')
