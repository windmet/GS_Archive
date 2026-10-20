import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import {createStageIndexTransport} from '../src/utils/StageIndexTransport.js'
import {createActualChibiIndexLoaders} from './lib/chibi-index-loader-harness.mjs'
const id=process.argv[2] || 'drvalv_live_effect',file='choreography/index.json'
async function measure(sharded) {
 const reads={},results={},refinements=[];let bytes=0
 const transport=createStageIndexTransport({fetchImpl:async url=>{
  reads[url]=(reads[url]||0)+1
  try {const text=await fs.readFile(new URL('../public'+url,import.meta.url),'utf8');bytes+=Buffer.byteLength(text);return {ok:true,text:async()=>text}}
  catch(error){if(error.code==='ENOENT')return {ok:false,status:404};throw error}
 }})
 const loaders=await createActualChibiIndexLoaders(transport),binding=await loaders.fetchLiveChibiSongChoreography(file,id)
 const song=binding.songs.find(song=>song.id===id)
 for(const name of ['CommandInventory','MouthFix','MotionOffset','MotionClock'])results[name]=await loaders['fetchLiveChibi'+name](file,{binding})
 results.lighting=await loaders.fetchLiveChibiStageEffectSong(id,{binding})
 const penlight=await loaders.fetchLiveChibiPenlights(file,{binding,songId:sharded?id:undefined})
 const {songs,eventCount,sourceEventCount,...header}=penlight.commands
 results.penlight={header,track:songs[id],model:penlight.model}
 let done
 const complete=new Promise(resolve=>{done=resolve})
 await loaders.fetchLiveChibiObjectLayerIndex({binding,song:sharded?song:undefined,onOptional:value=>{refinements.push(value);if(refinements.length===4)done()}})
 await complete
 const index=refinements.at(-1),{assets,...objectHeader}=index
 results.objects={header:objectHeader,assets:Object.fromEntries([...new Set(song.objectLayerEvents.map(event=>event.asset))].map(name=>[name,assets[name]]))}
 return {results,metrics:{sharded,id,sourceBytes:bytes,requests:Object.values(reads).reduce((a,b)=>a+b,0),reads,cache:transport.stats()}}
}
const before=await measure(false),after=await measure(true)
assert.deepEqual(after.results,before.results,'Selected native data and refinements must remain identical')
assert.ok(!after.metrics.reads['/data/stage-object-emitters.json'])
assert.ok(!after.metrics.reads['/data/stage-penlight-commands.json'])
assert.ok(!after.metrics.reads['/assets/live-chibi/penlight/index.json'])
console.log(JSON.stringify({selectedConsumerParity:true,before:before.metrics,after:after.metrics},null,2))
