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
  const loaders=await createActualChibiIndexLoaders(transport)
  const binding=await loaders.fetchLiveChibiSongChoreography(file,id)
  for(const name of ['CommandInventory','Penlights','MouthFix','MotionOffset','MotionClock'])results[name]=await loaders['fetchLiveChibi'+name](file,{binding})
  const pair=sharded?await loaders.fetchLiveChibiStageEffectSong(id,{binding}):{
    effects:await loaders.fetchLiveChibiStageEffectIndex(),commands:await loaders.fetchLiveChibiStagelights(file,{binding})}
  const {stagelights,stagelightSongs,...header}=pair.effects
  const track=pair.commands.songs[id],legacy=stagelightSongs[track.songCode]
  const names=new Set([...track.events,...(legacy?.events || [])].map(event=>event.asset).filter(name=>Object.hasOwn(stagelights,name)))
  results.lighting={header,track,legacy,models:Object.fromEntries([...names].map(name=>[name,stagelights[name]]))}
  let done
  const completed=new Promise(resolve=>{done=resolve})
  results.objects=await loaders.fetchLiveChibiObjectLayerIndex({binding,onOptional:value=>{refinements.push(value);if(refinements.length===4)done()}})
  await completed
  results.refined=refinements.at(-1);results.song=binding.songs.find(song=>song.id===id)
  return {results,metrics:{sharded,id,sourceBytes:bytes,requests:Object.values(reads).reduce((a,b)=>a+b,0),reads,cache:transport.stats()}}
}
const before=await measure(false),after=await measure(true)
assert.deepEqual(after.results,before.results,'Selected native tracks, model inputs and remaining consumers must remain identical')
assert.ok(!after.metrics.reads['/assets/live-chibi/stage-effects/index.json'])
assert.ok(!after.metrics.reads['/data/stage-stagelight-commands.json'])
assert.ok(!after.metrics.reads['/assets/live-chibi/choreography/index.json'])
console.log(JSON.stringify({selectedConsumerParity:true,before:before.metrics,after:after.metrics},null,2))
