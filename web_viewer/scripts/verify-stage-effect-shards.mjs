import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createStageIndexTransport} from '../src/utils/StageIndexTransport.js'
import {compileStageEffectShards,validateStageEffectCatalog,hydrateStageEffectShard,loadStageEffectSong,serializeStageEffectJSON,STAGE_EFFECT_CATALOG_URL} from '../src/core/chibiStageEffectShards.js'
import {attachNativeOldSuspension} from '../src/core/chibiOldSuspensionlights.js'
import {attachNativeSuspensionSprites} from '../src/core/chibiSuspensionlights.js'
import {createActualChibiIndexLoaders} from './lib/chibi-index-loader-harness.mjs'
const hash=text=>createHash('sha256').update(text).digest('hex')
const document=data=>({data,text:serializeStageEffectJSON(data)+'\n'})
assert.equal(serializeStageEffectJSON({angle:-0,other:0}),'\u007b"angle":-0,"other":0}')
assert.ok(Object.is(JSON.parse(serializeStageEffectJSON({angle:-0})).angle,-0))
assert.throws(()=>serializeStageEffectJSON({text:'\u0000stage-effect-negative-zero\u0000'}),/Reserved/)
const effects=document({assets:{},newSuspensionlight:{layers:[{asset:'default'}]},oldSuspensionlightSongs:{},
 stagelights:{lamp:{layers:[],angle:-0},unused:{layers:[]}},stagelightSongs:{first:{source:'first',events:[{asset:'lamp'}]}}})
const styles=Object.fromEntries(['Suspensionlight','Suspensionlight_2','Suspensionlight_3','Suspensionlight_4','Suspensionlight_5'].map(name=>[name,
 {clips:{angle60:{duration:2}},layers:[{asset:'sidelight',anchorX:.5,anchorY:0}]}]))
const songs={first_live_effect:{songCode:'first',source:'first.csv',tempo:{values:[120]},events:[{time:0,id:1,sourceRow:2,hide:false,asset:'lamp',alphaMode:2}]},
 second_live_effect:{songCode:'second',source:'second.csv',tempo:{values:[120]},events:[]}}
const documents={effects,commands:document({schemaVersion:1,choreographyIndexSha256:'c'.repeat(64),eventCount:1,songs}),
 oldSuspension:document({schemaVersion:1,contract:'native-old-suspension-v1',stageEffectIndexSha256:hash(effects.text),model:{styles},songs:{}}),
 sprites:document({schemaVersion:1,contract:'native-new-suspension-sprites-v1',stageEffectIndexSha256:hash(effects.text),sprites:{},songAssets:{},trackSha256:{}})}
const {catalog,files}=compileStageEffectShards(documents,hash)
files.set(STAGE_EFFECT_CATALOG_URL,JSON.stringify(catalog)+'\n')
const binding={sourceBinding:{file:'choreography/index.json',sha256:'c'.repeat(64)},songs:Object.entries(songs).map(([id,song])=>({id,...song}))}
const reads=[]
const transport=createStageIndexTransport({fetchImpl:async url=>{reads.push(url);return files.has(url)?{ok:true,text:async()=>files.get(url)}:{ok:false,status:404}}})
const first=await loadStageEffectSong(transport,'first_live_effect',{binding})
assert.deepEqual(Object.keys(first.effects.stagelights),['lamp'])
assert.deepEqual(first.commands.songs.first_live_effect,songs.first_live_effect)
assert.equal(first.commands.eventCount,1);assert.equal(first.commands.sourceEventCount,1)
const second=await loadStageEffectSong(transport,'second_live_effect',{binding})
assert.deepEqual(second.effects.stagelights,{})
assert.deepEqual(second.effects.stagelightSongs,{})
assert.deepEqual(Object.keys(second.commands.songs),['second_live_effect'])
assert.equal(second.commands.eventCount,0);assert.equal(second.commands.sourceEventCount,1)
await loadStageEffectSong(transport,'first_live_effect',{binding})
assert.equal((await (await createActualChibiIndexLoaders(transport)).fetchLiveChibiStageEffectSong('first_live_effect',{binding})).commands.eventCount,1)
assert.equal(reads.length,4,'One catalog/common and only the two requested songs; warm revisit shares sources')
assert.ok(!reads.some(url=>url.endsWith('/index.json') || url.endsWith('stage-stagelight-commands.json')))
for(const mutate of [c=>{c.common.file='/escape'},c=>{c.songs.first_live_effect.id='wrong'},c=>{c.sources.effects='bad'}]){
 const bad=structuredClone(catalog);mutate(bad);assert.throws(()=>validateStageEffectCatalog(bad))
}
const common=JSON.parse(files.get(catalog.common.file)),shard=JSON.parse(files.get(catalog.songs.first_live_effect.file))
assert.throws(()=>hydrateStageEffectShard(catalog,common,{...shard,id:'second_live_effect'},'first_live_effect',binding),/source\/identity/)
assert.throws(()=>hydrateStageEffectShard(catalog,common,shard,'first_live_effect',{...binding,sourceBinding:{file:'wrong',sha256:'c'.repeat(64)}}),/binding/)
assert.throws(()=>hydrateStageEffectShard(catalog,common,{...shard,models:{...shard.models,unused:{}}},'first_live_effect',binding),/model scope/)
await assert.rejects(loadStageEffectSong(transport,'unknown',{binding}),/Unknown/)
await assert.rejects(loadStageEffectSong(createStageIndexTransport({fetchImpl:async()=>({ok:false,status:404})}),'first_live_effect',{binding}),/404/)
for(const target of [catalog.common.file,catalog.songs.first_live_effect.file]) {
 let attempts=0
 const corrupt=createStageIndexTransport({fetchImpl:async url=>({ok:true,text:async()=>files.get(url)+(url===target && ++attempts===1?' ':'')})})
 await assert.rejects(loadStageEffectSong(corrupt,'first_live_effect',{binding}),/SHA-256/)
 assert.equal((await loadStageEffectSong(corrupt,'first_live_effect',{binding})).commands.eventCount,1)
}
// Cancelling one caller leaves its sibling's shared loads intact.
let start,release
const started=new Promise(resolve=>{start=resolve}),gate=new Promise(resolve=>{release=resolve}),controller=new AbortController()
const shared=createStageIndexTransport({fetchImpl:async url=>{if(url===catalog.common.file){start();await gate}return {ok:true,text:async()=>files.get(url)}}})
const cancelled=loadStageEffectSong(shared,'first_live_effect',{binding,signal:controller.signal}),survivor=loadStageEffectSong(shared,'first_live_effect',{binding})
await started;controller.abort();await assert.rejects(cancelled,{name:'AbortError'});release()
assert.equal((await survivor).commands.eventCount,1)
const sfc=await fs.readFile(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
assert.ok(!sfc.includes('fetchLiveChibiStageEffectIndex') && !sfc.includes('fetchLiveChibiStagelights'))
const change=sfc.slice(sfc.indexOf('async function handleSongChange()'),sfc.indexOf('function releaseAudio()'))
assert.match(change,/fetchLiveChibiStageEffectSong/)
assert.match(change,/if\(stageDisposed \|\| buildSequence !== stageBuildSequence\)return\s+choreography.value=index\s+stageEffectIndex.value=lighting.effects\s+stagelightData.value=lighting.commands/)
// Portable CI verifies tracked source hashes and complete picker identities.
const published=validateStageEffectCatalog(JSON.parse(await fs.readFile(new URL('../public'+STAGE_EFFECT_CATALOG_URL,import.meta.url),'utf8')))
const choreography=JSON.parse(await fs.readFile(new URL('../public/data/stage-choreography-shards.json',import.meta.url),'utf8'))
assert.equal(published.choreographyIndexSha256,choreography.index.sourceBinding.sha256)
assert.deepEqual(Object.keys(published.songs).sort(),choreography.index.songs.map(song=>song.id).sort())
for(const song of choreography.index.songs)for(const key of ['id','songCode','source'])assert.equal(published.songs[song.id][key],song[key])
for(const [name,path] of Object.entries({commands:'stage-stagelight-commands',oldSuspension:'stage-old-suspension',sprites:'stage-new-suspension-sprites'})){
 const text=await fs.readFile(new URL('../public/data/'+path+'.json',import.meta.url),'utf8')
 assert.equal(hash(text),published.sources[name],'Source changed: regenerate stage effect shards')
 if(name!=='commands')assert.equal(JSON.parse(text).stageEffectIndexSha256,published.sources.effects)
}
if(process.argv.includes('--published-assets')) {
 const paths={effects:'assets/live-chibi/stage-effects/index.json',commands:'data/stage-stagelight-commands.json',oldSuspension:'data/stage-old-suspension.json',sprites:'data/stage-new-suspension-sprites.json'}
 const source=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([name,path])=>{const text=await fs.readFile(new URL('../public/'+path,import.meta.url),'utf8');return [name,{text,data:JSON.parse(text)}]})))
 const generated=compileStageEffectShards(source,hash)
 assert.deepEqual(generated.catalog,published)
 for(const [file,text] of generated.files)assert.equal(await fs.readFile(new URL('../public'+file,import.meta.url),'utf8'),text)
 const full=attachNativeSuspensionSprites(attachNativeOldSuspension(source.effects.data,source.oldSuspension.data,hash(source.effects.text)),source.sprites.data,hash(source.effects.text))
 const actual=await createActualChibiIndexLoaders(createStageIndexTransport({fetchImpl:async url=>{
  assert.ok(url!== '/assets/live-chibi/stage-effects/index.json' && url!=='/data/stage-stagelight-commands.json','No global fallback')
  return {ok:true,text:()=>fs.readFile(new URL('../public'+url,import.meta.url),'utf8')}
 }}))
 for(const song of choreography.index.songs) {
  const result=await actual.fetchLiveChibiStageEffectSong(song.id,{binding:choreography.index})
  const {stagelights,stagelightSongs,...header}=result.effects
  const {stagelights:allModels,stagelightSongs:allSongs,...fullHeader}=full
  assert.deepEqual(header,fullHeader)
  assert.deepEqual(stagelightSongs,allSongs[song.songCode]?{[song.songCode]:allSongs[song.songCode]}:{})
  for(const [name,model] of Object.entries(stagelights))assert.deepEqual(model,allModels[name])
  const expected=source.commands.data.songs[song.id]
  assert.deepEqual(result.commands.songs,{[song.id]:expected})
  assert.equal(result.commands.eventCount,expected.events.length)
  const names=new Set([...expected.events,...(allSongs[song.songCode]?.events || [])].map(event=>event.asset).filter(name=>Object.hasOwn(allModels,name)))
  assert.deepEqual(new Set(Object.keys(stagelights)),names)
 }
 console.log(JSON.stringify({arrangements:choreography.index.songs.length,commonBytes:published.common.bytes,catalogBytes:Buffer.byteLength(JSON.stringify(published)+'\n'),maxShard:Math.max(...Object.values(published.songs).map(song=>song.bytes))}))
}
console.log('Stage effect shards: source/identity/hash/model scope, paired switching, corrupt-cache recovery, cancellation and native consumer parity passed')
