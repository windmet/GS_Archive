import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createStageIndexTransport} from '../src/utils/StageIndexTransport.js'
import {compileChoreographyShards,validateChoreographyCatalog,hydrateChoreographyShard,loadChoreographyCatalog,loadChoreographySong,CHOREOGRAPHY_CATALOG_URL} from '../src/core/chibiChoreographyShards.js'
import {attachNativeSpotlights} from '../src/core/chibiSpotlightTimeline.js'
import {attachWholeScreen} from '../src/core/chibiWholeScreen.js'
import {attachSearchlights} from '../src/core/chibiSearchlights.js'
import {createActualChibiIndexLoaders} from './lib/chibi-index-loader-harness.mjs'
const hash=value=>createHash('sha256').update(value).digest('hex'),file='choreography/index.json'
const document=data=>{const text=JSON.stringify(data)+'\n';return {text,data}}
const songs=['first','second'].map(id=>({id:id+'_live_effect',songCode:id,source:id+'_live_effect.csv',title:id,variant:'standard',positions:[3],stagePositionMap:[],duration:1000,events:[{time:0,motion:id}],spotlightEvents:[]}))
const choreography=document({schemaVersion:1,motionCatalog:[],songs})
const sourceHash=hash(choreography.text)
const tracks=Object.fromEntries(songs.map(song=>[song.id,{songCode:song.songCode,source:song.source,events:[],textSha256:'a'.repeat(64),raw:{textAsset:song.id,bundleSha256:'a'.repeat(64),textSha256:'b'.repeat(64)}}]))
const documents={choreography,
 spotlight:document({schemaVersion:1,contract:'native-spotlight-v1',choreographyIndexSha256:sourceHash,songs:tracks}),
 wholeScreen:document({contract:'native-whole-screen-v1',choreographyIndexSha256:sourceHash,models:{},songs:tracks}),
 searchlights:document({contract:'native-searchlights-v1',choreographyIndexSha256:sourceHash,assets:{},songs:tracks})}
const {catalog,files}=compileChoreographyShards(documents,hash)
files.set(CHOREOGRAPHY_CATALOG_URL,JSON.stringify(catalog)+'\n')
const reads=[]
const transport=createStageIndexTransport({fetchImpl:async url=>{
 reads.push(url);return files.has(url)?{ok:true,text:async()=>files.get(url)}:{ok:false,status:404}
}})
assert.equal((await loadChoreographyCatalog(transport,file)).index.songs.length,2)
assert.ok(catalog.index.songs.every(song=>!('events' in song)))
const first=await loadChoreographySong(transport,file,songs[0].id)
assert.equal(first.songs[0].events[0].motion,'first');assert.equal(first.songs[1].events,undefined)
const second=await loadChoreographySong(transport,file,songs[1].id)
assert.equal(second.songs[1].events[0].motion,'second');assert.equal(second.songs[0].events,undefined)
await loadChoreographySong(transport,file,songs[0].id)
assert.equal(reads.length,3,'Catalog + requested shards only, warm revisit shares document')
assert.ok(!reads.some(path=>path.endsWith('/index.json')),'No global choreography fallback')
assert.throws(()=>validateChoreographyCatalog(catalog,'wrong/index.json'),/binding/)
for(const change of [c=>{c.shards[songs[0].id].file='/../escape.json'},c=>{c.shards[songs[0].id].songCode='wrong'},c=>{c.index.songs.push(c.index.songs[0])},c=>{c.native.spotlight.choreographyIndexSha256='c'.repeat(64)}]) {
 const bad=structuredClone(catalog);change(bad);assert.throws(()=>validateChoreographyCatalog(bad,file))
}
await assert.rejects(loadChoreographySong(transport,file,'unknown'),/Unknown/)
const descriptor=catalog.shards[songs[0].id]
let shardAttempts=0
const tampered=createStageIndexTransport({fetchImpl:async url=>({ok:true,text:async()=>url===CHOREOGRAPHY_CATALOG_URL?files.get(url):files.get(url)+(++shardAttempts===1?' ':'')})})
await assert.rejects(loadChoreographySong(tampered,file,songs[0].id),/SHA-256/)
assert.equal((await loadChoreographySong(tampered,file,songs[0].id)).songs[0].events[0].motion,'first','Corrupt cached bytes are discarded before a retry')
const shard=JSON.parse(files.get(descriptor.file));shard.song.songCode='wrong'
assert.throws(()=>hydrateChoreographyShard(catalog,shard,songs[0].id),/identity/)
shard.song.songCode=songs[0].songCode;shard.choreographyIndexSha256='f'.repeat(64)
assert.throws(()=>hydrateChoreographyShard(catalog,shard,songs[0].id),/source/)
const abort=new AbortController();abort.abort()
await assert.rejects(loadChoreographySong(transport,file,songs[0].id,{signal:abort.signal}),{name:'AbortError'})
await assert.rejects(loadChoreographySong(createStageIndexTransport({fetchImpl:async()=>({ok:false,status:404})}),file,songs[0].id),/404/)
// A cancellation during SHA-256 must never hand a hydrated song to the caller.
let complete,started
const hashing=new Promise(resolve=>{started=resolve}),slowHash=new Promise(resolve=>{complete=resolve}),cancel=new AbortController()
const slow=createStageIndexTransport({fetchImpl:async url=>({ok:true,text:async()=>files.get(url)}),digest:()=>{started();return slowHash}})
const pending=loadChoreographySong(slow,file,songs[0].id,{signal:cancel.signal})
await hashing;cancel.abort();complete(Buffer.from(descriptor.sha256,'hex'))
await assert.rejects(pending,{name:'AbortError'})
const sfc=await fs.readFile(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
assert.match(sfc,/sharded:true/)
assert.match(sfc,/Array\.isArray\(selectedSong\.value\.events\)/)
const change=sfc.slice(sfc.indexOf('async function handleSongChange()'),sfc.indexOf('function releaseAudio()'))
assert.ok(change.indexOf('fetchLiveChibiSongChoreography(')<change.indexOf('await Promise.all([loadSongLipSync()'))
assert.match(change,/if\(stageDisposed \|\| buildSequence !== stageBuildSequence\)return\s+choreography.value=index/)

// CI has these tracked inputs even without the ignored canonical asset corpus.
const publishedCatalog=validateChoreographyCatalog(JSON.parse(await fs.readFile(new URL('../public'+CHOREOGRAPHY_CATALOG_URL,import.meta.url),'utf8')),file)
for(const [name,path] of Object.entries({spotlight:'stage-spotlight-commands',wholeScreen:'stage-whole-screen',searchlights:'stage-searchlights'})) {
 const text=await fs.readFile(new URL('../public/data/'+path+'.json',import.meta.url),'utf8')
 assert.equal(hash(text),publishedCatalog.inputs[name].sha256,'Native source changed: regenerate choreography shards')
 const {songs,...common}=JSON.parse(text)
 assert.deepEqual(publishedCatalog.native[name],common)
}
const boundReads=[]
const boundTransport=createStageIndexTransport({fetchImpl:async url=>{
 boundReads.push(url)
 assert.ok(url.startsWith('/data/'),'Bound consumers must not read the global asset index')
 return {ok:true,text:()=>fs.readFile(new URL('../public'+url,import.meta.url),'utf8')}
}})
const actual=await createActualChibiIndexLoaders(boundTransport)
const binding=await actual.fetchLiveChibiChoreography(file,{sharded:true})
await Promise.all(['CommandInventory','MouthFix','MotionOffset','MotionClock','Stagelights'].map(name=>actual['fetchLiveChibi'+name](file,{binding})))
assert.equal(boundReads.length,6)
await assert.rejects(actual.fetchLiveChibiMotionClock(file,{binding:{...binding,sourceBinding:{file:'wrong',sha256:binding.sourceBinding.sha256}}}),/binding/)
await assert.rejects(actual.fetchLiveChibiMotionClock(file,{binding:{...binding,sourceBinding:{file,sha256:'0'.repeat(64)}}}),/does not match/)

if(process.argv.includes('--published-assets')) {
 const paths={choreography:'assets/live-chibi/choreography/index.json',spotlight:'data/stage-spotlight-commands.json',wholeScreen:'data/stage-whole-screen.json',searchlights:'data/stage-searchlights.json'}
 const corpus=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([key,path])=>{
  const text=await fs.readFile(new URL('../public/'+path,import.meta.url),'utf8');return [key,{text,data:JSON.parse(text)}]
 })))
 const generated=compileChoreographyShards(corpus,hash)
 assert.deepEqual(JSON.parse(await fs.readFile(new URL('../public'+CHOREOGRAPHY_CATALOG_URL,import.meta.url),'utf8')),generated.catalog)
 const source=hash(corpus.choreography.text)
 const legacy=attachSearchlights(attachWholeScreen(attachNativeSpotlights(corpus.choreography.data,corpus.spotlight.data,source),corpus.wholeScreen.data,source),corpus.searchlights.data,source)
 let total=0
 for(const original of legacy.songs) {
  const descriptor=generated.catalog.shards[original.id]
  const text=await fs.readFile(new URL('../public'+descriptor.file,import.meta.url),'utf8')
  assert.equal(text,generated.files.get(descriptor.file));assert.equal(hash(text),descriptor.sha256);assert.equal(Buffer.byteLength(text),descriptor.bytes)
  const hydrated=hydrateChoreographyShard(generated.catalog,JSON.parse(text),original.id)
  assert.deepEqual(hydrated.songs.find(song=>song.id===original.id),original,'All original fields and native tracks must survive')
  assert.equal(hydrated.songs.filter(song=>Array.isArray(song.events)).length,1)
  total+=descriptor.bytes
 }
 assert.equal(legacy.songs.length,118)
 console.log(JSON.stringify({arrangements:118,sourceBytes:Buffer.byteLength(corpus.choreography.text),catalogBytes:Buffer.byteLength(JSON.stringify(generated.catalog)+'\n'),shardBytes:total,maxShard:Math.max(...Object.values(generated.catalog.shards).map(row=>row.bytes))}))
}
console.log('Choreography shards: requested-only loading, exact source parity, hash/identity/path guards, cancellation and switch ownership passed')
