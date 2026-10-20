import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
const source=fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
const mounted=source.slice(source.indexOf('onMounted(async () => {'),source.indexOf('\nonBeforeUnmount('))
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
const flush=()=>new Promise(resolve=>setImmediate(resolve))
const ref=value=>({value})
function fixture(){
  const jobs=Object.fromEntries(['manifest','catalog','clock','music','originals','song','lighting','penlight','objects','lipsync'].map(k=>[k,deferred()]))
  const starts=[],errors=[],song={id:'drvalv_live_effect',songCode:'drvalv'},catalog={songs:[song]}
  let mountedPromise
  const c={Promise,Map,JSON,handleStageShortcut(){},window:{addEventListener(){}},nextTick:async()=>{},stageDisposed:false,lifetime:new AbortController(),props:{},MAINTAINER:false,
    onMounted:fn=>{mountedPromise=fn()},createPixiApp(){starts.push('app')},initializeLineup(){},
    manifest:ref(null),choreography:ref(null),motionClockData:ref(null),musicIndex:ref(null),nativeOriginalLineups:ref(null),songs:ref([song]),selectedSongId:ref(''),selectedSong:ref(song),
    stageEffectIndex:ref(null),stagelightData:ref(null),characters:ref([]),lineup:ref([]),booting:ref(true),errorText:ref(''),
    stageVocalEnabled:ref(false),stageReady:ref(false),mouthFixData:ref(null),motionOffsetData:ref(null),
    backmonitorIndex:ref(null),imageLayerIndex:ref(null),imageObjectIndex:ref(null),stageBackgroundIndex:ref(null),
    resolveSongStageHandoff:()=>null,console:{warn(){},error(...v){errors.push(v)}},
    fetchLiveChibiManifest:()=>start('manifest'),fetchLiveChibiChoreography:()=>start('catalog'),
    fetchLiveChibiMotionClock:()=>start('clock'),fetchLiveChibiMusicIndex:()=>start('music'),
    fetchLiveChibiOriginalLineups:()=>start('originals'),
    fetchLiveChibiSongChoreography:()=>start('song'),fetchLiveChibiStageEffectSong:()=>start('lighting'),
    loadCurrentPenlights:()=>start('penlight'),loadCurrentObjectIndex:()=>start('objects'),loadSongLipSync:()=>start('lipsync'),
    loadSongAudio:async()=>{starts.push('audio')},rebuildStage:async()=>{starts.push('actors')},
    fetchLiveChibiMotionOffset:async()=>null,fetchLiveChibiMouthFix:async()=>null,applyCurrentLipSync(){},requestPausedSuspensionRender(){},
    fetchLiveChibiBackmonitorIndex:async()=>null,fetchLiveChibiImageLayerIndex:async()=>null,fetchLiveChibiImageObjectIndex:async()=>null,fetchLiveChibiStageBackgroundIndex:async()=>null,
    syncBackmonitor:async()=>{},syncImageLayers:async()=>{},syncStageBackground:async()=>{},
  }
  function start(name){starts.push(name);return jobs[name].promise}
  vm.createContext(c);vm.runInContext(mounted,c)
  return {c,jobs,starts,errors,catalog,done:()=>mountedPromise}
}
async function base(f,holdOriginals=false){
  await flush();f.jobs.manifest.resolve({choreography:{index:'choreography/index.json'}});await flush()
  f.jobs.catalog.resolve(f.catalog);await flush()
  if(!holdOriginals)f.jobs.originals.resolve({songs:{}})
}
{
  const f=fixture();await base(f,true)
  assert.equal(f.errors.length,0,JSON.stringify(f.errors));assert(f.starts.includes('clock') && f.starts.includes('music'),'Clock and music must start before either resolves')
  f.jobs.music.resolve({songs:[]});await flush();assert(!f.starts.includes('song'))
  f.jobs.clock.resolve({native:true});await flush()
  assert(!f.starts.includes('song'),'Original member source is required before member controls become ready')
  f.jobs.originals.resolve({songs:{}});await flush()
  assert(f.starts.includes('song') && f.starts.includes('lighting'),'Song and lighting must start together')
  f.jobs.lighting.resolve({effects:{native:true},commands:{native:true}});await flush();assert(!f.starts.includes('penlight'))
  f.jobs.song.resolve(f.catalog);await flush()
  for(const name of ['penlight','objects','lipsync','audio'])assert(f.starts.includes(name),`${name} must not wait on another input`)
  assert(!f.starts.includes('actors'))
  f.jobs.penlight.resolve(false);f.jobs.objects.resolve(true);await flush()
  assert(!f.starts.includes('actors'),'Actors still wait for lip-sync, preserving existing readiness boundary')
  f.jobs.lipsync.resolve();await f.done();assert.equal(f.starts.filter(n=>n==='actors').length,1)
  assert.equal(f.errors.length,0)
}
{
  const f=fixture();await base(f);f.c.stageDisposed=true
  f.jobs.clock.resolve({});f.jobs.music.resolve({});await f.done()
  assert(!f.starts.includes('song'),'Disposed stage must not enter next phase')
}
{
  const f=fixture();await base(f);f.jobs.clock.reject(Error('native clock missing'));await f.done()
  assert(!f.starts.includes('song'));assert.equal(f.c.errorText.value,'native clock missing')
  assert.equal(f.c.booting.value,false)
  f.jobs.music.resolve({});await flush();assert(!f.starts.includes('actors'))
}
console.log('Stage initial loading: actual mounted pipeline parallel starts, required barriers, disposal and failure passed')
