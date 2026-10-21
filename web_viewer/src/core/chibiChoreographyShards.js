import {attachNativeSpotlights} from './chibiSpotlightTimeline.js'
import {attachWholeScreen} from './chibiWholeScreen.js'
import {attachSearchlights} from './chibiSearchlights.js'

export const CHOREOGRAPHY_CATALOG_URL='/data/stage-choreography-shards.json'
const digest=value=>typeof value==='string' && /^[a-f0-9]{64}$/.test(value)
const fields=['id','songCode','variant','title','source','startTime','duration','positions','performerSlots','onStagePerformerSlots','stagePositionMap','motionIds','lipSync','vocalSetting']
export const choreographyMetadata=song=>Object.fromEntries(fields.filter(key=>key in song).map(key=>[key,song[key]]))
const identity=(a,b)=>a?.id===b?.id && a?.songCode===b?.songCode && a?.source===b?.source
const cancelled=signal=>{if(signal?.aborted)throw new DOMException('Request cancelled','AbortError')}

export function validateChoreographyBinding(index,file) {
  const source=index?.sourceBinding
  if(source?.file!==file || !digest(source?.sha256) || !Array.isArray(index.songs))
    throw Error('Choreography catalog source binding mismatch')
  return source
}

export function validateChoreographyCatalog(data,file) {
  if(data?.schemaVersion!==1 || data.contract!=='stage-choreography-shards-v1')throw Error('Invalid choreography shard catalog')
  const source=validateChoreographyBinding(data.index,file)
  if(!data.shards || Object.keys(data.shards).length!==data.index.songs.length || !data.index.songs.length)
    throw Error('Choreography shard catalog count mismatch')
  const seen=new Set()
  for(const song of data.index.songs) {
    const shard=data.shards[song.id]
    if(seen.has(song.id) || !identity(song,shard) || !/^[a-z0-9_-]+$/.test(song.id)
      || !digest(shard.sha256) || !Number.isSafeInteger(shard.bytes) || shard.bytes<=0
      || shard.file!==`/assets/live-chibi/choreography/shards/${song.id}.${shard.sha256}.json`
      || JSON.stringify(song)!==JSON.stringify(choreographyMetadata(song)))
      throw Error('Invalid choreography shard descriptor/identity')
    seen.add(song.id)
  }
  for(const name of ['spotlight','wholeScreen','searchlights']) {
    if(data.native?.[name]?.choreographyIndexSha256!==source.sha256 || 'songs' in data.native[name]
      || !digest(data.inputs?.[name]?.sha256))throw Error('Choreography native shard source mismatch')
  }
  return data
}

export function hydrateChoreographyShard(catalog,shard,id) {
  const descriptor=catalog.shards[id],metadata=catalog.index.songs.find(song=>song.id===id)
  if(!descriptor || shard?.schemaVersion!==1 || shard.contract!=='stage-choreography-song-v1'
    || shard.choreographyIndexSha256!==catalog.index.sourceBinding.sha256 || !identity(shard.song,metadata)
    || JSON.stringify(choreographyMetadata(shard.song))!==JSON.stringify(metadata))
    throw Error('Choreography shard source/identity mismatch')
  const source=catalog.index.sourceBinding.sha256
  let index={...catalog.index,songs:[shard.song]}
  index=attachNativeSpotlights(index,{...catalog.native.spotlight,songs:{[id]:shard.spotlight}},source)
  index=attachWholeScreen(index,{...catalog.native.wholeScreen,songs:{[id]:shard.wholeScreen}},source)
  index=attachSearchlights(index,{...catalog.native.searchlights,songs:{[id]:shard.searchlights}},source)
  // Retain the picker catalog, not every previously visited song's event arrays.
  return {...index,songs:catalog.index.songs.map(song=>song.id===id?index.songs[0]:song)}
}

export async function loadChoreographyCatalog(transport,file,{signal}={}) {
  const document=await transport.load(CHOREOGRAPHY_CATALOG_URL,{signal})
  cancelled(signal)
  return validateChoreographyCatalog(document.data,file)
}

export async function loadChoreographySong(transport,file,id,{signal}={}) {
  const catalog=await loadChoreographyCatalog(transport,file,{signal})
  const descriptor=catalog.shards[id]
  if(!descriptor)throw Error('Unknown choreography shard')
  const document=await transport.load(descriptor.file,{signal})
  const hash=await document.hash()
  cancelled(signal)
  if(hash!==descriptor.sha256) {
    transport.invalidate(descriptor.file)
    throw Error('Choreography shard SHA-256 mismatch')
  }
  return hydrateChoreographyShard(catalog,document.data,id)
}

// Used by the generator and portable/corpus verifier. Native attachment uses
// the same validators as the runtime; no second parser or per-song patch table.
export function compileChoreographyShards(documents,hash) {
  const sourceHash=hash(documents.choreography.text)
  const source=documents.choreography.data
  const native={},inputs={}
  for(const name of ['spotlight','wholeScreen','searchlights']) {
    const {songs,...common}=documents[name].data
    native[name]=common;inputs[name]={sha256:hash(documents[name].text)}
  }
  const catalog={schemaVersion:1,contract:'stage-choreography-shards-v1',
    index:{...source,songs:source.songs.map(choreographyMetadata),sourceBinding:{file:'choreography/index.json',sha256:sourceHash}},
    native,inputs,shards:{}}
  const files=new Map()
  for(const song of source.songs) {
    const shard={schemaVersion:1,contract:'stage-choreography-song-v1',choreographyIndexSha256:sourceHash,song,
      ...Object.fromEntries(['spotlight','wholeScreen','searchlights'].map(name=>[name,documents[name].data.songs[song.id]]))}
    const text=JSON.stringify(shard)+'\n',sha256=hash(text)
    const file=`/assets/live-chibi/choreography/shards/${song.id}.${sha256}.json`
    catalog.shards[song.id]={id:song.id,songCode:song.songCode,source:song.source,file,sha256,bytes:new TextEncoder().encode(text).byteLength}
    files.set(file,text)
  }
  validateChoreographyCatalog(catalog,'choreography/index.json')
  for(const [id,descriptor] of Object.entries(catalog.shards))hydrateChoreographyShard(catalog,JSON.parse(files.get(descriptor.file)),id)
  return {catalog,files}
}
