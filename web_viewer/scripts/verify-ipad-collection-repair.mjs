import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {claimMusicAudioSession,releaseMusicAudioSession} from '../src/utils/musicAudioSession.js'
import {chartTileWindow,chartColumnWindow,chartGeometryWindow} from '../src/presentation/SongChartViewport.js'
import {buildSongChartGeometry} from '../src/presentation/SongChartPresentation.js'
import {collectionIdols,collectionSummary,honorIdol,honorSourceLabel,itemAttribute} from '../src/presentation/CollectionBrowse.js'
import {createCollectionCatalogSession} from '../readmodels/runtime/CollectionCatalogSession.mjs'
const a={},b={},session={type:'auto'},nav={audioSession:session}
claimMusicAudioSession(a,nav);assert.equal(session.type,'playback')
claimMusicAudioSession(b,nav);releaseMusicAudioSession(a);assert.equal(session.type,'playback')
releaseMusicAudioSession(b);assert.equal(session.type,'auto')
claimMusicAudioSession(a,{});releaseMusicAudioSession(a)
claimMusicAudioSession(a,{audioSession:{get type(){return 'auto'},set type(v){throw Error('unsupported')}}});releaseMusicAudioSession(a)
claimMusicAudioSession(a,nav);session.type='play-and-record';releaseMusicAudioSession(a);assert.equal(session.type,'play-and-record')
const catalog=JSON.parse(await fs.readFile('public/data/song_catalog.json'))
let charts=0,notes=0
for(const song of Object.values(catalog.songs))for(const d of song.gameplay.difficulties){
 const chart=JSON.parse(await fs.readFile('public'+d.chart.url)),g=buildSongChartGeometry(chart)
 const seen=new Set()
 for(let y=0;y<g.height;y+=768){
  const slices=chartTileWindow(g.height,y,820)
  assert(slices.length<=5);assert(slices.every(t=>t.height<=768&&t.height>0))
  for(const tile of slices)for(const n of chartGeometryWindow(g,tile.from,tile.from+tile.height).notes)seen.add(n.id)
 }
 assert.equal(seen.size,g.notes.length);charts++;notes+=seen.size
}
assert.deepEqual(chartColumnWindow(100,2600,1040,260),[9,10,11,12,13,14])
const index=JSON.parse(await fs.readFile('config/collection-browse.v1.json'))
const bootstrap=JSON.parse(await fs.readFile('readmodels/bootstrap.inline.json'))
assert.equal(index.release,bootstrap.release,'collection source summaries must follow the active readmodel release')
assert.equal(collectionIdols.length,49)
let bond50=0,bond100=0,owners=0
for(const [key,value] of Object.entries(index.entries)){
 const row={id:key.split(':')[1],nameJa:value.nameJa,resourceId:value.resourceId,honorType:value.resourceId.startsWith('honor_idol_')?2:1}
 assert(collectionSummary(row,key.startsWith('honor:')?'honors':'items',index.release))
 assert.equal(collectionSummary(row,'honors','wrong-release'),null)
 assert.equal(collectionSummary({...row,nameJa:'wrong-name'},'honors',index.release),null)
 if(key.startsWith('honor:')){const source=honorSourceLabel(row,index.release);if(source==='偶像羁绊 Lv.50')bond50++;if(source==='偶像羁绊 Lv.100')bond100++;if(honorIdol(row))owners++}
}
assert.equal(bond50,49);assert.equal(bond100,49);assert.equal(owners,122)
assert.equal(itemAttribute({nameJa:'フィジカルバッジ'}),'physical');assert.equal(itemAttribute({nameJa:'unknown'}),'')
let details=0
const directory=createCollectionCatalogSession({catalog:async()=>[{id:'1'}],detail:async()=>{details++;return {entry:{id:'1',key:'item:1'}}}},()=>{})
assert(await directory.open('items','',{selectDefault:false}));assert.equal(details,0);assert.equal(directory.state.detailBusy,false)
assert(await directory.open('items','item:1',{selectDefault:false}));assert.equal(details,1);directory.dispose()
console.log(`Music audio session ownership/recovery policy passed; ${charts} charts / ${notes} notes covered by bounded tiles; collection 49+49 bonds, 122 owners and lazy detail passed.`)
import {createSSRApp} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {useSongPerformanceSession} from '../src/composables/useSongPerformanceSession.js'
const nodes=[]
const gain=()=>({gain:{value:0,setValueAtTime(){}},connect(next){return next},disconnect(){}})
const ctx={state:'interrupted',currentTime:0,destination:{},resumes:0,createGain:gain,createBufferSource(){const node={...gain(),playbackRate:{value:1},start(at,offset){node.started={at,offset}},stop(){}};nodes.push(node);return node},async resume(){this.resumes++;this.state='running'},async decodeAudioData(){return {duration:130}},close(){this.state='closed'}}
let player
await renderToString(createSSRApp({setup(){player=useSongPerformanceSession({contextFactory:()=>ctx});return ()=>null}}))
const priorFetch=globalThis.fetch,priorRAF=globalThis.requestAnimationFrame,priorCancel=globalThis.cancelAnimationFrame
try{
 globalThis.fetch=async()=>new Response(new Uint8Array([1,2,3]));globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{}
 await player.configure({experiment:{backing:{url:'/backing'},solo_tracks:{'001tom':{vocal:{url:'/vocal'}}}},events:[],performerLineup:['001tom'],continuous:true})
 assert(player.ready.value);assert(await player.play());assert.equal(ctx.resumes,1);assert.equal(nodes.length,2);assert(nodes.every(n=>n.started.at===0.05&&n.started.offset===0))
 ctx.currentTime=3;ctx.state='interrupted';ctx.onstatechange();assert.equal(player.playing.value,false);assert.equal(player.currentTime.value,2.95)
 assert(await player.play());assert.equal(ctx.resumes,2);assert.equal(nodes.at(-1).started.offset,2.95);player.release()
 // Navigating away during resume must not schedule stale buffers.
 await player.configure({experiment:{backing:{url:'/backing'},solo_tracks:{}},events:[],performerLineup:[]})
 ctx.state='suspended';let resume;ctx.resume=()=>new Promise(resolve=>{resume=()=>{ctx.state='running';resolve()}})
 const playing=player.play();player.release();resume();assert.equal(await playing,false);assert.equal(player.playing.value,false)
}finally{globalThis.fetch=priorFetch;globalThis.requestAnimationFrame=priorRAF;globalThis.cancelAnimationFrame=priorCancel}
console.log('Interrupted context resumes from gesture; two sources start together; interruption preserves seek; stale resume cannot schedule unloaded buffers.')
