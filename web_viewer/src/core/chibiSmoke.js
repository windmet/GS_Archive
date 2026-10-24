import {assertSmokeSystem,SMOKE_BINDING} from './chibiSmokeMotion.js'

export function validateSmokeData(data,hash) {
  if(data?.contract!=='source-linked-smoke-preview-v1' || data.choreographyIndexSha256!==hash
    || data.sourceSha256!==SMOKE_BINDING.sourceSha256 || hash!==SMOKE_BINDING.choreographyIndexSha256)
    throw Error('Smoke source binding mismatch')
  if(data.systems?.length!==6 || new Set(data.systems.map(s=>s.source.pathId)).size!==6)throw Error('Incomplete Smoke systems')
  for(const system of data.systems)assertSmokeSystem(system)
  if(JSON.stringify(Object.keys(data.songs).sort())!==JSON.stringify([...SMOKE_BINDING.arrangements].sort()))throw Error('Incomplete Smoke arrangements')
  for(const track of Object.values(data.songs))for(const event of track.events)
    if(!Number.isFinite(event.time)||![1,2].includes(event.variant)||typeof event.hide!=='boolean'||!Number.isFinite(event.depth))throw Error('Invalid Smoke command')
  return data
}

// Native Show selects one group and sets every renderer's order. Erase stops
// emission on all systems; it does not fade or disable surviving particles.
// Epochs are rebuilt from commands on every seek. Original Play/resume clock
// parity remains outside this deterministic Web preview.
export function smokeAt(track,time) {
  const state={variant:0,depth:0,epochs:[]}
  for(const event of [...(track?.events||[])].sort((a,b)=>a.time-b.time)){
    if(event.time>time)break
    const current=state.epochs.at(-1)
    if(event.hide){if(current&&current.stop==null)current.stop=event.time;continue}
    if(event.variant!==state.variant)state.epochs=[]
    state.variant=event.variant;state.depth=event.depth
    if(state.epochs.at(-1)?.stop==null&&state.epochs.length)continue
    state.epochs.push({start:event.time,stop:null})
  }
  return state
}
