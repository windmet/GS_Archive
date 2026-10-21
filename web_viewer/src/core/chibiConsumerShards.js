import {validatePenlightData} from './chibiPenlights.js'
import {validateChoreographyBinding} from './chibiChoreographyShards.js'
import {serializeStageEffectJSON as serializeNativeJSON} from './chibiStageEffectShards.js'

export const CONSUMER_CATALOG_URL='/data/stage-consumer-shards.json'
const base='/assets/live-chibi/consumer-shards/'
const digest=value=>typeof value==='string' && /^[a-f0-9]{64}$/.test(value)
const cancelled=signal=>{if(signal?.aborted)throw new DOMException('Request cancelled','AbortError')}
const sameSong=(a,b)=>a?.songCode===b?.songCode && a?.source===b?.source
const descriptor=(item,name)=>item && digest(item.sha256) && item.file===`${base}${name}.${item.sha256}.json`
  && Number.isSafeInteger(item.bytes) && item.bytes>0

export function validateConsumerCatalog(data) {
  if(data?.schemaVersion!==1 || data.contract!=='stage-consumer-shards-v1' || !descriptor(data.common,'common')
    || !data.songs || !data.emitters || !digest(data.choreographyIndexSha256) || !digest(data.objectIndexSha256))
    throw Error('Invalid consumer shard catalog')
  for(const key of ['penlightCommands','penlightModel','emitters'])if(!digest(data.sources?.[key]))throw Error('Invalid consumer canonical source')
  for(const [id,song] of Object.entries(data.songs))
    if(!/^[a-z0-9_-]+$/.test(id) || song.id!==id || !song.songCode || !song.source || !descriptor(song,`penlight-${id}`))throw Error('Invalid Penlight shard identity/path')
  for(const [name,item] of Object.entries(data.emitters))
    if(!/^[A-Za-z0-9_-]+$/.test(name) || item.name!==name || !descriptor(item,`emitter-${name}`))throw Error('Invalid emitter shard identity/path')
  return data
}

async function verified(transport,item,{signal}={}) {
  const document=await transport.load(item.file,{signal}),hash=await document.hash()
  cancelled(signal)
  if(hash!==item.sha256){transport.invalidate(item.file);throw Error('Consumer shard SHA-256 mismatch')}
  return document.data
}

async function loadCommon(transport,{signal,binding}={}) {
  const record=await transport.load(CONSUMER_CATALOG_URL,{signal}),catalog=validateConsumerCatalog(record.data)
  const canonical=validateChoreographyBinding(binding,'choreography/index.json')
  if(canonical.sha256!==catalog.choreographyIndexSha256)throw Error('Consumer choreography binding mismatch')
  const common=await verified(transport,catalog.common,{signal})
  if(common?.schemaVersion!==1 || common.contract!=='stage-consumer-common-v1'
    || common.penlightCommandsSha256!==catalog.sources.penlightCommands || common.emitterIndexSha256!==catalog.sources.emitters
    || common.penlightHeader?.choreographyIndexSha256!==canonical.sha256
    || common.penlightHeader.modelSha256!==catalog.sources.penlightModel || 'songs' in common.penlightHeader
    || common.emitterHeader?.objectIndexSha256!==catalog.objectIndexSha256
    || common.emitterHeader.choreographyIndexSha256!==canonical.sha256 || 'assets' in common.emitterHeader)
    throw Error('Consumer common source mismatch')
  return {catalog,common}
}

export async function loadPenlightSong(transport,id,options={}) {
  const {catalog,common}=await loadCommon(transport,options),item=catalog.songs[id]
  if(!item || !sameSong(item,options.binding.songs.find(song=>song.id===id)))throw Error('Unknown Penlight shard identity')
  const shard=await verified(transport,item,options)
  if(shard?.schemaVersion!==1 || shard.contract!=='penlight-song-v1' || shard.id!==id
    || shard.sourceSha256!==catalog.sources.penlightCommands || !sameSong(shard.track,item))throw Error('Penlight shard source mismatch')
  const commands=validatePenlightData({...common.penlightHeader,sourceEventCount:common.penlightHeader.eventCount,
    eventCount:shard.track.events.length,songs:{[id]:shard.track}},catalog.choreographyIndexSha256,catalog.sources.penlightModel)
  return {commands,model:common.penlightModel}
}

export async function loadObjectEmitterSelection(transport,song,options={}) {
  const {catalog,common}=await loadCommon(transport,options)
  const identity=catalog.songs[song?.id]
  if(!sameSong(identity,song) || !sameSong(options.binding.songs.find(row=>row.id===song?.id),song)
    || !Array.isArray(song.objectLayerEvents))throw Error('Emitter selection identity mismatch')
  const names=[...new Set(song.objectLayerEvents.map(event=>event.asset))].filter(name=>Object.hasOwn(catalog.emitters,name))
  const entries=await Promise.all(names.map(async name=>{
    const shard=await verified(transport,catalog.emitters[name],options)
    if(shard?.schemaVersion!==1 || shard.contract!=='object-emitter-v1' || shard.name!==name
      || shard.sourceSha256!==catalog.sources.emitters || !shard.model)throw Error('Emitter shard source/identity mismatch')
    return [name,shard.model]
  }))
  cancelled(options.signal)
  return {...common.emitterHeader,assets:Object.fromEntries(entries)}
}

export function compileConsumerShards(documents,hash) {
  const sources=Object.fromEntries(Object.entries(documents).map(([key,value])=>[key,hash(value.text)]))
  const penlight=documents.penlightCommands.data,emitters=documents.emitters.data
  validatePenlightData(penlight,penlight.choreographyIndexSha256,sources.penlightModel)
  if(emitters.choreographyIndexSha256!==penlight.choreographyIndexSha256 || !digest(emitters.objectIndexSha256))throw Error('Consumer source mismatch')
  const {songs,...penlightHeader}=penlight,{assets,...emitterHeader}=emitters
  const common={schemaVersion:1,contract:'stage-consumer-common-v1',penlightCommandsSha256:sources.penlightCommands,
    emitterIndexSha256:sources.emitters,penlightHeader,penlightModel:documents.penlightModel.data,emitterHeader}
  const files=new Map()
  const write=(name,value)=>{
    const text=serializeNativeJSON(value)+'\n',sha256=hash(text),file=`${base}${name}.${sha256}.json`
    files.set(file,text);return {file,sha256,bytes:new TextEncoder().encode(text).byteLength}
  }
  const catalog={schemaVersion:1,contract:'stage-consumer-shards-v1',sources,choreographyIndexSha256:penlight.choreographyIndexSha256,
    objectIndexSha256:emitters.objectIndexSha256,common:write('common',common),songs:{},emitters:{}}
  for(const [id,track] of Object.entries(songs))catalog.songs[id]={id,songCode:track.songCode,source:track.source,...write(`penlight-${id}`,
    {schemaVersion:1,contract:'penlight-song-v1',id,sourceSha256:sources.penlightCommands,track})}
  for(const [name,model] of Object.entries(assets))catalog.emitters[name]={name,...write(`emitter-${name}`,
    {schemaVersion:1,contract:'object-emitter-v1',name,sourceSha256:sources.emitters,model})}
  validateConsumerCatalog(catalog)
  return {catalog,files}
}
