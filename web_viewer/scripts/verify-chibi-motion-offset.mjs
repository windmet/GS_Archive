import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {danceStartOffsetAt,randomMotionGateAt,randomMotionDueTime,validateMotionOffsetData} from '../src/core/chibiMotionOffset.js'
import {validateSongChart} from '../src/presentation/SongChartPresentation.js'
const track={events:[{time:-2000,sourceRow:2,erase:false,offsetMs:50}],tempo:{values:[120]}}
assert.equal(danceStartOffsetAt(track.events,-2001),0)
assert.equal(danceStartOffsetAt([...track.events,{time:0,sourceRow:3,erase:true}],100),50,'Native erase does not reset offset')
assert.equal(randomMotionGateAt(track,1949).allowed,false)
assert.equal(randomMotionGateAt(track,1950).allowed,true)
assert.equal(randomMotionDueTime(track,100),1950)
assert.equal(randomMotionDueTime(track,4000),4000,'Gate never shifts an already-due authored handoff backwards')
assert.equal(randomMotionDueTime({...track,events:[{time:0,sourceRow:2,erase:false,offsetMs:-100}]},0),2100)
assert.equal(randomMotionDueTime({...track,events:[...track.events,{time:1000,sourceRow:3,erase:false,offsetMs:1500}]},100),1000)
assert.equal(randomMotionDueTime({...track,events:[...track.events,{time:1000,sourceRow:3,erase:true}]},100),1950)
assert.equal(danceStartOffsetAt([...track.events,{time:-2000,sourceRow:3,erase:false,offsetMs:70}],0),70)
const variable={...track,tempo:{values:[90,156]}}
assert.equal(randomMotionGateAt(variable,1000).allowed,false)
assert.equal(randomMotionGateAt(variable,1900).allowed,null,'Unknown variable-tempo timing stays explicit')
assert.equal(randomMotionGateAt(variable,3000).allowed,true)
assert.equal(randomMotionDueTime(variable,1900),null)
assert.equal(randomMotionDueTime(variable,3000),3000)

const sfc=readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
const block=sfc.match(/const performanceEventsByPosition = computed\(\(\) => \{[^]*?\n\}\)/)[0]
const compute=new Function('computed','allPositions','selectedSong','activePositions','activeMotionGroupAt','weightedGroupMotion','motionOffsetTrack','randomMotionDueTime',block+';return performanceEventsByPosition')
const song={id:'a',duration:10000,events:[{time:0,stagePosition:1,motion:'authored',pauseTime:100},
  {time:5000,stagePosition:1,motion:'next',pauseTime:999999}]}
function timeline(input,t=track) {
  return compute(fn=>({value:fn()}),[1],{value:input},{value:[1]},()=>0,()=>({motion:'random'}),{value:t},randomMotionDueTime).value.get(1)
}
assert.deepEqual(timeline(song).map(e=>[e.time,e.motion]),[[0,'authored'],[1950,'random'],[5000,'next']])
assert.equal(timeline(song)[1].nativeOffsetGate,'resolved')
assert.deepEqual(timeline({...song,events:[song.events[0],{...song.events[1],time:1000}]}).map(e=>e.motion),['authored','next'],'An explicit next command takes priority before the random gate opens')
assert.equal(timeline(song,null)[1].nativeOffsetGate,'pending','Optional inputs cannot be presented as resolved')
const uncertain=timeline({...song,events:[{...song.events[0],pauseTime:1900},song.events[1]]},variable)
assert.equal(uncertain[1].time,1900);assert.equal(uncertain[1].nativeOffsetGate,'pending','Preserved preview fallback remains labelled approximate')

const hash=text=>createHash('sha256').update(text).digest('hex')
const data=JSON.parse(readFileSync(new URL('../public/data/stage-motion-offset.json',import.meta.url)))
validateMotionOffsetData(data,data.choreographyIndexSha256)
assert.equal(data.eventCount,98);assert.equal(Object.keys(data.songs).length,118)
assert.throws(()=>validateMotionOffsetData(data,'a'.repeat(64)),/does not match/)
assert.throws(()=>validateMotionOffsetData({...data,eventCount:99},data.choreographyIndexSha256),/count mismatch/)
const source=readFileSync(new URL('../src/utils/liveChibiSpine.js',import.meta.url),'utf8')
const body=source.match(/export async function fetchLiveChibiMotionOffset\([^]*?\n\}/)[0]
const makeLoader=new Function('indexTransport','LIVE_CHIBI_BASE','validateMotionOffsetData','crypto',body.replace('export async function','async function')+';return fetchLiveChibiMotionOffset')
const fakeIndex='{}',fixture={...data,choreographyIndexSha256:hash(fakeIndex)}
const loader=makeLoader({async load(url){return url.startsWith('/data/')?JSON.stringify(fixture):fakeIndex}},'/assets/live-chibi',validateMotionOffsetData,globalThis.crypto)
assert.equal((await loader('choreography/index.json')).eventCount,98)
const abort=new AbortController();abort.abort();await assert.rejects(loader('index.json',{signal:abort.signal}),{name:'AbortError'})
await assert.rejects(makeLoader({async load(){throw Error('HTTP 404')}},'',validateMotionOffsetData,globalThis.crypto)('index.json'),/404/)
if(process.argv.includes('--published-assets')) {
  const text=readFileSync(new URL('../public/assets/live-chibi/choreography/index.json',import.meta.url),'utf8')
  validateMotionOffsetData(data,hash(text))
  const songs=JSON.parse(text).songs,inventory=JSON.parse(readFileSync(new URL('../public/data/stage-command-inventory.json',import.meta.url)))
  let handoffs=0,pending=0,changed=0
  for(const song of songs) {
    const t=data.songs[song.id]
    assert.equal(t.source,song.source)
    assert.equal(t.events.length,inventory.songs[song.id].commands.Livechara_Offset || 0)
    const chartText=readFileSync(new URL('../public/data/'+t.tempo.file,import.meta.url),'utf8')
    assert.equal(hash(chartText),t.tempo.sha256)
    const chart=validateSongChart(JSON.parse(chartText),song.songCode,1)
    assert.deepEqual([...new Set(chart.tempos.map(t=>t.tempo))].sort((a,b)=>a-b),t.tempo.values)
    for(const event of song.events)if(event.pauseTime>0 && event.pauseTime<999999) {
      const due=event.time+event.pauseTime,result=randomMotionDueTime(t,due)
      handoffs++;if(result===null)pending++;else if(result!==due)changed++
    }
  }
  console.log(`RAW: 98 offsets / 118 arrangements; ${handoffs} candidate handoffs, ${changed} gated, ${pending} ambiguous`)
}
console.log('PASS motion offset: native four-beat predicate, no-op erase, future assignments, tempo bounds, actual SFC scheduling and loader binding')
