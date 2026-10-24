import {withStageIndexTransport} from './lib/stage-index-harness.mjs'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {NATIVE_MOUTH_CLOSED_RATE as closed,mouthFixAt,validateMouthFixData} from '../src/core/chibiMouthFix.js'
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`)
const event={time:100,sourceRow:2,target:0,erase:false,openRate:.5,duration:200}
const erase={time:200,sourceRow:3,target:1,erase:true,duration:100}
const target=closed+(1-closed)*.5
assert.equal(mouthFixAt([event],1,99).active,false)
near(mouthFixAt([event],1,200).rate,closed+(target-closed)*.75)
near(mouthFixAt([event],5,300).rate,target)
assert.equal(mouthFixAt([event],6,300).active,false,'Native target zero selects only positions 1..5')
const interrupted=mouthFixAt([event,erase],1,250)
near(interrupted.rate,closed+(target-closed)*.75*.25)
assert.equal(interrupted.active,true)
assert.equal(mouthFixAt([event,erase],1,300).active,false,'Release only after erase tween completes')
assert.equal(mouthFixAt([event,erase],2,300).active,true,'Target erase leaves other slots fixed')
assert.equal(mouthFixAt([erase],1,250).active,false,'Erase cannot activate an unfixed mouth')
near(mouthFixAt([{...event,openRate:9}],1,300).rate,1)
near(mouthFixAt([{...event,openRate:-2}],1,300).rate,closed)
near(mouthFixAt([event],1,100,{immediate:true}).rate,target)
assert.equal(mouthFixAt([event,erase],1,200,{immediate:true}).active,false)
const interruptedFix={...event,time:250,sourceRow:4,target:1,openRate:1}
near(mouthFixAt([event,erase,interruptedFix],1,250).rate,interrupted.rate)
assert.deepEqual(mouthFixAt([event,erase],1,150),mouthFixAt([event],1,150),'Backward replay is history independent')
assert.equal(mouthFixAt([event,{...erase,time:100}],1,300).active,false,'Same timestamp preserves source order')

// Execute the actual installed Spine hook, including its later animation update.
const source=readFileSync(new URL('../src/utils/liveChibiSpine.js',import.meta.url),'utf8')
const sample=source.match(/export function sampleLiveChibiLipSync\([^]*?\n\}/)[0].replace('export ','')
const install=source.match(/function installLiveChibiLipSync\([^]*?\n\}/)[0]
const apply=source.match(/export function applyLiveChibiLipSync\([^]*?\n\}/)[0].replace('export ','')
const constants=source.match(/^const LIVE_CHIBI_LIP_[^\n]+/gm).join('\n')
const hook=new Function('NATIVE_MOUTH_CLOSED_RATE',constants+'\n'+sample+'\n'+install+'\n'+apply+';return {installLiveChibiLipSync,applyLiveChibiLipSync}')(closed)
const bone={data:{scaleX:2,scaleY:3},scaleX:2,scaleY:3},mouth={attachment:{name:'mouth_open'},data:{attachmentName:'mouth_open'},bone}
let transforms=0
const skeleton={findSlot:name=>name==='head'?{attachment:{name:'head_fl'}}:name==='mouth'?mouth:null,findBone:()=>bone,
  setAttachment(slot,name){assert.equal(slot,'mouth');mouth.attachment={name}},updateWorldTransform(){transforms++}}
const runtime={spine:{skeleton},lipSyncController:hook.installLiveChibiLipSync({skeleton})}
bone.scaleY=7
let frame=hook.applyLiveChibiLipSync(runtime,null,0,false,{active:true,rate:target})
assert.equal(frame.attachment,'mouth_open_fl');near(bone.scaleX,target);assert.equal(bone.scaleY,7)
skeleton.updateWorldTransform();near(bone.scaleX,target)
frame=hook.applyLiveChibiLipSync(runtime,null,0,false,{active:true,rate:closed})
assert.equal(frame.attachment,'mouth_close_fl');near(bone.scaleX,1)
frame=hook.applyLiveChibiLipSync(runtime,{sampleRate:60,values:[.8]},0,true,{active:false,rate:closed})
assert.equal(frame.fixed,null);near(bone.scaleX,2*1.2);assert.equal(bone.scaleY,3)
hook.applyLiveChibiLipSync(runtime,null,0,false)
assert.equal(runtime.lipSyncController.fixed,null);assert.ok(transforms>=5)

// Run the actual SFC consumer: native idol slots, singing independence,
// source identity, and switching to an arrangement without fixed mouths.
const sfc=readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
const consumer=sfc.match(/function applyCurrentLipSync\([^]*?\n\}/)[0]
const selected={value:{id:'a',songCode:'a',source:'a.csv'}}
const input={value:{songs:{a:{songCode:'a',source:'a.csv',events:[{...event,target:2}]}}}}
const slots={value:[2,4]},clock={value:300},singers={value:[4]},positions={value:[]},rates={value:''},calls=[]
const sourceSlot=sfc.match(/function sourceSlotForStagePosition\([^]*?\n\}/)[0]
const runConsumer=new Function('selectedSong','mouthFixData','activePositions','stageTime','currentSingerPositions','mouthFixedPositions','mouthFixedRates','runtimes','lipSyncCurve','mouthFixAt','applyLiveChibiLipSync',sourceSlot+'\n'+consumer+';return applyCurrentLipSync')(selected,input,slots,clock,singers,positions,rates,new Map([[1,'one'],[2,'two'],[3,'three'],[4,'four'],[5,'five']]),{},mouthFixAt,(...args)=>calls.push(args))
runConsumer()
assert.deepEqual(positions.value,[2]);assert.equal(calls[0][3],false);assert.equal(calls[0][4].active,true)
assert.equal(calls[1][3],true);assert.equal(calls[1][4].active,false)
selected.value={...selected.value,source:'wrong.csv'};runConsumer();assert.deepEqual(positions.value,[])
selected.value={id:'b',songCode:'b',source:'b.csv'};runConsumer();assert.equal(rates.value,'')
assert.equal(calls.at(-2)[4].active,false,'Switching clears the old mouth override even with a surviving runtime')

const hash=text=>createHash('sha256').update(text).digest('hex')
const data=JSON.parse(readFileSync(new URL('../public/data/stage-mouth-fix.json',import.meta.url)))
// Real Center lines: native target1 must animate mapped center3, not screen1.
// Execute the actual consumer and actual installed Spine hook while singing is off.
const centerMap=[{performerSlot:1,stagePosition:3},{performerSlot:2,stagePosition:2},
  {performerSlot:3,stagePosition:4},{performerSlot:4,stagePosition:1}]
slots.value=[1,2,3,4];singers.value=[]
for(const [id,time,expectedRate] of [['flslgt_live_effect',36000,closed+(1-closed)*.65],
  ['pcuslv_live_effect',60700,closed+(1-closed)*.6]]) {
  const track=data.songs[id]
  selected.value={id,songCode:track.songCode,source:track.source,stagePositionMap:centerMap}
  input.value=data;clock.value=time;calls.length=0;runConsumer()
  assert.deepEqual(positions.value,[3],`${id}: fixed mouth follows native performer1 to screen3`)
  const center=calls.find(call=>call[0]==='three'),side=calls.find(call=>call[0]==='one')
  assert.equal(center[3],false);assert.equal(center[4].active,true);near(center[4].rate,expectedRate)
  assert.equal(side[4].active,false,'Screen1 must not receive the native center override')
  hook.applyLiveChibiLipSync(runtime,null,time,false,center[4]);near(bone.scaleX,expectedRate)
  clock.value=id.startsWith('flslgt')?36700:61400;calls.length=0;runConsumer()
  const closedCenter=calls.find(call=>call[0]==='three')[4]
  assert.equal(closedCenter.active,true);near(closedCenter.rate,closed)
  hook.applyLiveChibiLipSync(runtime,null,clock.value,false,closedCenter)
  assert.equal(runtime.lipSyncController.attachment,'mouth_close_fl')
  clock.value=id.startsWith('flslgt')?37800:61901;runConsumer();assert.deepEqual(positions.value,[])
  clock.value=time;runConsumer();assert.deepEqual(positions.value,[3],'Rewind restores the mapped target')
}
assert.equal(data.eventCount,29);assert.equal(Object.values(data.songs).filter(track=>track.events.length).length,4)
validateMouthFixData(data,data.choreographyIndexSha256)
assert.throws(()=>validateMouthFixData(data,'a'.repeat(64)),/does not match/)
assert.throws(()=>validateMouthFixData({...data,eventCount:30},data.choreographyIndexSha256),/count mismatch/)
const invalid=structuredClone(data);Object.values(invalid.songs).find(t=>t.events.length).events[0].duration=-1
assert.throws(()=>validateMouthFixData(invalid,data.choreographyIndexSha256),/event\/order/)
const loaderBody=source.match(/export async function fetchLiveChibiMouthFix\([^]*?\n\}/)[0]
const makeLoader=withStageIndexTransport(new Function('indexTransport','LIVE_CHIBI_BASE','validateMouthFixData','crypto',loaderBody.replace('export async function','async function')+';return fetchLiveChibiMouthFix'))
const fakeIndex='{}',fixture={...data,choreographyIndexSha256:hash(fakeIndex)}
const loader=makeLoader({async load(url){return url.startsWith('/data/')?JSON.stringify(fixture):fakeIndex}},'/assets/live-chibi',validateMouthFixData,globalThis.crypto)
assert.equal((await loader('choreography/index.json')).eventCount,29)
const abort=new AbortController();abort.abort();await assert.rejects(loader('index.json',{signal:abort.signal}),{name:'AbortError'})
await assert.rejects(makeLoader({async load(){throw Error('HTTP 404')}},'',validateMouthFixData,globalThis.crypto)('index.json'),/404/)
if(process.argv.includes('--published-assets')) {
  const text=readFileSync(new URL('../public/assets/live-chibi/choreography/index.json',import.meta.url),'utf8')
  validateMouthFixData(data,hash(text))
  const arrangements=JSON.parse(text).songs
  const inventory=JSON.parse(readFileSync(new URL('../public/data/stage-command-inventory.json',import.meta.url)))
  for(const [id,track] of Object.entries(data.songs)) {
    assert.equal(track.events.length,inventory.songs[id].commands.Livechara_mouth_shape_fix || 0)
    if(track.events.length) {
      const song=arrangements.find(song=>song.id===id)
      assert.ok(song,`Missing choreography ${id}`)
      selected.value=song;slots.value=song.positions;input.value=data
      for(const event of track.events)for(const time of [event.time,event.time+event.duration/2,event.time+event.duration]) {
        clock.value=time;runConsumer()
        const expected=song.stagePositionMap.filter(entry=>song.positions.includes(entry.stagePosition)
          && mouthFixAt(track.events,entry.performerSlot,time).active).map(entry=>entry.stagePosition).sort((a,b)=>a-b)
        assert.deepEqual(positions.value,expected,`${id} at ${time}: actual consumer uses published slot mapping`)
      }
    }
    for(const e of track.events)for(const p of [1,2,3,4,5])for(const t of [e.time,e.time+e.duration/2,e.time+e.duration])
      assert.ok(Number.isFinite(mouthFixAt(track.events,p,t).rate))
  }
}
console.log('PASS mouth fix: native rate/OutQuad/interrupt/target/erase/replay, actual Spine hook, mapped Center lines, async loader binding and all 29 events')
