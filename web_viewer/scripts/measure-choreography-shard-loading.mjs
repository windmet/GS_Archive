import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import {createStageIndexTransport} from '../src/utils/StageIndexTransport.js'
import {createActualChibiIndexLoaders} from './lib/chibi-index-loader-harness.mjs'
const id=process.argv[2] || 'drvalv_live_effect',file='choreography/index.json'
async function measure(sharded) {
  const reads={},results={},retained=[];let bytes=0
  const transport=createStageIndexTransport({fetchImpl:async url=>{
    reads[url]=(reads[url]||0)+1
    try {const text=await fs.readFile(new URL('../public'+url,import.meta.url),'utf8');bytes+=Buffer.byteLength(text);return {ok:true,text:async()=>text}}
    catch(error){if(error.code==='ENOENT')return {ok:false,status:404};throw error}
  }})
  const loaders=await createActualChibiIndexLoaders(transport)
  let index=await loaders.fetchLiveChibiChoreography(file,{sharded})
  if(sharded)index=await loaders.fetchLiveChibiSongChoreography(file,id)
  const binding=sharded?index:undefined
  const names=['CommandInventory','Penlights','MouthFix','MotionOffset','MotionClock','Stagelights']
  for(const name of names)results[name]=await loaders['fetchLiveChibi'+name](file,{binding})
  results.effects=await loaders.fetchLiveChibiStageEffectIndex()
  let complete
  const done=new Promise(resolve=>{complete=resolve})
  results.objects=await loaders.fetchLiveChibiObjectLayerIndex({binding,onOptional:result=>{retained.push(result);if(retained.length===4)complete()}})
  await done
  results.refined=retained.at(-1);results.song=index.songs.find(song=>song.id===id)
  return {results,metrics:{sharded,id,sourceBytes:bytes,requests:Object.values(reads).reduce((a,b)=>a+b,0),reads,cache:transport.stats()}}
}
const before=await measure(false),after=await measure(true)
assert.deepEqual(after.results,before.results,'Native consumers and selected-song data must remain identical')
assert.ok(!after.metrics.reads['/assets/live-chibi/choreography/index.json'])
assert.ok(!after.metrics.reads['/data/stage-spotlight-commands.json'])
assert.ok(!after.metrics.reads['/data/stage-whole-screen.json'])
assert.ok(!after.metrics.reads['/data/stage-searchlights.json'])
console.log(JSON.stringify({outputParity:true,before:before.metrics,after:after.metrics},null,2))
