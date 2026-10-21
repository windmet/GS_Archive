import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createStageIndexTransport} from '../src/utils/StageIndexTransport.js'
import {createSongIndexSession} from '../src/core/chibiSongIndexSession.js'
import {compileConsumerShards,validateConsumerCatalog,loadPenlightSong,loadObjectEmitterSelection,CONSUMER_CATALOG_URL} from '../src/core/chibiConsumerShards.js'
import {serializeStageEffectJSON as serializeNativeJSON} from '../src/core/chibiStageEffectShards.js'
import {createActualChibiIndexLoaders} from './lib/chibi-index-loader-harness.mjs'
const hash=text=>createHash('sha256').update(text).digest('hex'),doc=data=>({data,text:serializeNativeJSON(data)+'\n'})
const model=doc({textures:{},prefabs:[],signedZero:-0})
const tracks={first_live_effect:{songCode:'first',source:'first.csv',nativeIdolType:1,events:[]},second_live_effect:{songCode:'second',source:'second.csv',nativeIdolType:2,events:[]}}
const documents={penlightModel:model,penlightCommands:doc({schemaVersion:1,choreographyIndexSha256:'c'.repeat(64),modelSha256:hash(model.text),eventCount:0,idolColors:{},songs:tracks}),
 emitters:doc({schemaVersion:1,choreographyIndexSha256:'c'.repeat(64),objectIndexSha256:'a'.repeat(64),textures:{texture:{signedZero:-0}},
 assets:{fx_Incident:{systems:[],deferred:[],signedZero:-0},unused:{systems:[],deferred:[]}}})}
const {catalog,files}=compileConsumerShards(documents,hash)
files.set(CONSUMER_CATALOG_URL,JSON.stringify(catalog)+'\n')
const binding={sourceBinding:{file:'choreography/index.json',sha256:'c'.repeat(64)},songs:Object.entries(tracks).map(([id,track])=>({id,...track}))}
const song={...binding.songs[0],objectLayerEvents:[{asset:'fx_Incident'},{asset:'fx_Incident'},{asset:'unresolved'}]}
const reads=[]
const transport=createStageIndexTransport({fetchImpl:async url=>{reads.push(url);return files.has(url)?{ok:true,text:async()=>files.get(url)}:{ok:false,status:404}}})
const penlight=await loadPenlightSong(transport,song.id,{binding})
assert.ok(Object.is(penlight.model.signedZero,-0))
assert.deepEqual(Object.keys(penlight.commands.songs),[song.id])
const selected=await loadObjectEmitterSelection(transport,song,{binding})
assert.deepEqual(Object.keys(selected.assets),['fx_Incident']);assert.ok(Object.is(selected.assets.fx_Incident.signedZero,-0))
assert.deepEqual(selected.textures,documents.emitters.data.textures)
await loadPenlightSong(transport,song.id,{binding});await loadObjectEmitterSelection(transport,song,{binding})
assert.equal(reads.length,4,'One common/catalog, one Penlight track and one requested emitter')
const actual=await createActualChibiIndexLoaders(transport)
assert.equal((await actual.fetchLiveChibiPenlights('choreography/index.json',{binding,songId:song.id})).commands.eventCount,0)
await assert.rejects(actual.fetchLiveChibiPenlights('wrong/index.json',{binding,songId:song.id}),/binding/)
await assert.rejects(loadObjectEmitterSelection(transport,song,{binding:{...binding,songs:[]}}),/identity/)
assert.deepEqual((await loadObjectEmitterSelection(transport,{...song,objectLayerEvents:[]},{binding})).assets,{})
await assert.rejects(loadObjectEmitterSelection(transport,{...song,songCode:'wrong'},{binding}),/identity/)
await assert.rejects(loadPenlightSong(transport,'unknown',{binding}),/identity/)
await assert.rejects(loadPenlightSong(transport,song.id,{binding:{...binding,sourceBinding:{file:'wrong',sha256:'c'.repeat(64)}}}),/binding/)
for(const mutate of [c=>{c.common.file='/escape'},c=>{c.emitters.fx_Incident.name='wrong'},c=>{c.songs.first_live_effect.id='wrong'}]){
 const bad=structuredClone(catalog);mutate(bad);assert.throws(()=>validateConsumerCatalog(bad))
}
let attempts=0
const target=catalog.emitters.fx_Incident.file
const corrupt=createStageIndexTransport({fetchImpl:async url=>({ok:true,text:async()=>files.get(url)+(url===target && ++attempts===1?' ':'')})})
await assert.rejects(loadObjectEmitterSelection(corrupt,song,{binding}),/SHA-256/)
assert.ok((await loadObjectEmitterSelection(corrupt,song,{binding})).assets.fx_Incident)
const abort=new AbortController();abort.abort()
await assert.rejects(loadPenlightSong(transport,song.id,{binding,signal:abort.signal}),{name:'AbortError'})
// Initial/cached refinements, A→B→A, late failures and invalidation ownership.
let active='A',callbacks=[],installed=[],failures=0
const session=createSongIndexSession({isCurrent:id=>id===active,install:value=>installed.push(value),onError:()=>{failures++},
 load:async options=>{callbacks.push(options.onOptional);options.onOptional({id:options.song.id,refined:true});return {id:options.song.id}}})
await session.load({song:{id:'A'}});assert.deepEqual(installed.at(-1),{id:'A',refined:true})
active='B';await session.load({song:{id:'B'}});callbacks[0]({id:'stale A'})
assert.deepEqual(installed.at(-1),{id:'B',refined:true})
active='A';await session.load({song:{id:'A'}});callbacks[0]({id:'old A generation'})
assert.deepEqual(installed.at(-1),{id:'A',refined:true})
session.invalidate();callbacks.at(-1)({id:'disposed'});assert.equal(installed.at(-1).id,'A')
let rejectOld
const failing=createSongIndexSession({isCurrent:id=>id===active,install:value=>installed.push(value),onError:()=>{failures++},
 load:options=>options.song.id==='A'?new Promise((_,reject)=>{rejectOld=reject}):Promise.resolve({id:'B'})})
const old=failing.load({song:{id:'A'}});active='B';await failing.load({song:{id:'B'}});rejectOld(Error('late A failure'));await old
assert.equal(failures,0);assert.equal(installed.at(-1).id,'B')
const graceful=createSongIndexSession({isCurrent:()=>true,install:()=>assert.fail(),load:async()=>{throw Error('Penlight missing')},onError:()=>{failures++}})
assert.equal(await graceful.load({song:{id:'B'}}),false);assert.equal(failures,1)

const published=validateConsumerCatalog(JSON.parse(await fs.readFile(new URL('../public'+CONSUMER_CATALOG_URL,import.meta.url),'utf8')))
const choreography=JSON.parse(await fs.readFile(new URL('../public/data/stage-choreography-shards.json',import.meta.url),'utf8'))
assert.equal(published.choreographyIndexSha256,choreography.index.sourceBinding.sha256)
for(const [key,path] of Object.entries({emitters:'stage-object-emitters',penlightCommands:'stage-penlight-commands'}))
 assert.equal(hash(await fs.readFile(new URL('../public/data/'+path+'.json',import.meta.url))),published.sources[key],'Tracked source changed: regenerate consumer shards')
assert.deepEqual(Object.keys(published.songs).sort(),choreography.index.songs.map(song=>song.id).sort())
for(const song of choreography.index.songs)for(const key of ['id','songCode','source'])assert.equal(published.songs[song.id][key],song[key])
const sfc=await fs.readFile(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
assert.match(sfc,/songId:options.song.id/)
assert.match(sfc,/objectIndexSession.load\(\{signal:lifetime.signal,binding:choreography.value,song:selectedSong.value\}\)/)
assert.ok(sfc.includes('loadCurrentPenlights(),loadCurrentObjectIndex()'))
if(process.argv.includes('--published-assets')) {
 const paths={penlightModel:'assets/live-chibi/penlight/index.json',penlightCommands:'data/stage-penlight-commands.json',emitters:'data/stage-object-emitters.json'}
 const source=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([key,path])=>{const text=await fs.readFile(new URL('../public/'+path,import.meta.url),'utf8');return [key,{text,data:JSON.parse(text)}]})))
 const generated=compileConsumerShards(source,hash);assert.deepEqual(generated.catalog,published)
 for(const [file,text] of generated.files)assert.equal(await fs.readFile(new URL('../public'+file,import.meta.url),'utf8'),text)
 const loaders=await createActualChibiIndexLoaders(createStageIndexTransport({fetchImpl:async url=>({ok:true,text:()=>fs.readFile(new URL('../public'+url,import.meta.url),'utf8')})}))
 const fullObjects=await new Promise(async(resolve,reject)=>{
  let count=0
  try {await loaders.fetchLiveChibiObjectLayerIndex({binding:choreography.index,onOptional:index=>{if(++count===4)resolve(index)}})}catch(error){reject(error)}
 })
 for(const metadata of choreography.index.songs) {
  const binding=await loaders.fetchLiveChibiSongChoreography('choreography/index.json',metadata.id)
  const song=binding.songs.find(song=>song.id===metadata.id)
  const penlight=await loaders.fetchLiveChibiPenlights('choreography/index.json',{binding,songId:song.id})
  assert.deepEqual(penlight.model,source.penlightModel.data)
  assert.deepEqual(penlight.commands.songs,{[song.id]:source.penlightCommands.data.songs[song.id]})
  assert.equal(penlight.commands.eventCount,penlight.commands.songs[song.id].events.length)
  assert.equal(penlight.commands.sourceEventCount,source.penlightCommands.data.eventCount)
  const selected=await loadObjectEmitterSelection(transportForFiles(generated.files,published),song,{binding})
  const names=new Set(song.objectLayerEvents.map(event=>event.asset).filter(name=>Object.hasOwn(source.emitters.data.assets,name)))
  assert.deepEqual(new Set(Object.keys(selected.assets)),names)
  for(const name of names)assert.deepEqual(selected.assets[name],source.emitters.data.assets[name])
  const refined=await new Promise(async(resolve,reject)=>{
   let count=0
   try {await loaders.fetchLiveChibiObjectLayerIndex({binding,song,onOptional:index=>{if(++count===4)resolve(index)}})}catch(error){reject(error)}
  })
  for(const name of new Set(song.objectLayerEvents.map(event=>event.asset)))assert.deepEqual(refined.assets[name],fullObjects.assets[name])
 }
 console.log(JSON.stringify({songs:118,emitterAssets:80,catalogBytes:Buffer.byteLength(JSON.stringify(published)+'\n'),commonBytes:published.common.bytes}))
}
function transportForFiles(files,catalog){return createStageIndexTransport({fetchImpl:async url=>({ok:true,text:async()=>url===CONSUMER_CATALOG_URL?JSON.stringify(catalog):files.get(url)})})}
console.log('Consumer shards: selected native data, signed zero, cache/hash/source guards and late-result ownership passed')
