import {attachNativeOldSuspension} from './chibiOldSuspensionlights.js'
import {attachNativeSuspensionSprites} from './chibiSuspensionlights.js'
import {validateStagelightData} from './chibiStagelights.js'
import {validateChoreographyBinding} from './chibiChoreographyShards.js'

export const STAGE_EFFECT_CATALOG_URL='/data/stage-effect-shards.json'
const base='/assets/live-chibi/stage-effects/shards/'
const digest=value=>typeof value==='string' && /^[a-f0-9]{64}$/.test(value)
const cancelled=signal=>{if(signal?.aborted)throw new DOMException('Request cancelled','AbortError')}
const sameSong=(a,b)=>a?.songCode===b?.songCode && a?.source===b?.source
const descriptor=(value,name)=>value && digest(value.sha256) && value.file===`${base}${name}.${value.sha256}.json`
  && Number.isSafeInteger(value.bytes) && value.bytes>0
const modelNames=shard=>new Set([...shard.track.events,...(shard.legacySong?.events || [])].map(event=>event.asset).filter(Boolean))

export function serializeStageEffectJSON(value) {
  // Native prefab data contains signed zero. JSON.parse retains it, while the
  // default stringify erases it. Reserve/escape a tag without rounding floats.
  const tag='\u0000stage-effect-negative-zero\u0000'
  return JSON.stringify(value,(_key,item)=>{
    if(item===tag)throw Error('Reserved stage effect serialization tag')
    return Object.is(item,-0)?tag:item
  }).replaceAll(JSON.stringify(tag),'-0')
}

export function validateStageEffectCatalog(data) {
  if(data?.schemaVersion!==1 || data.contract!=='stage-effect-shards-v1' || !descriptor(data.common,'common')
    || !digest(data.choreographyIndexSha256) || !data.songs || !Object.keys(data.songs).length)
    throw Error('Invalid stage effect shard catalog')
  for(const name of ['effects','commands','oldSuspension','sprites'])
    if(!digest(data.sources?.[name]))throw Error('Invalid stage effect canonical source binding')
  for(const [id,song] of Object.entries(data.songs)) {
    if(!/^[a-z0-9_-]+$/.test(id) || song.id!==id || !song.songCode || !song.source || !descriptor(song,id))
      throw Error('Invalid stage effect shard identity/path')
  }
  return data
}

export function hydrateStageEffectShard(catalog,common,shard,id,binding) {
  const canonical=validateChoreographyBinding(binding,'choreography/index.json')
  const song=catalog.songs[id],selected=binding.songs.find(song=>song.id===id)
  if(catalog.choreographyIndexSha256!==canonical.sha256 || !song || !sameSong(song,selected)
    || common?.schemaVersion!==1 || common.contract!=='stage-effect-common-v1'
    || shard?.schemaVersion!==1 || shard.contract!=='stage-effect-song-v1' || shard.id!==id || !sameSong(shard,song)
    || [common,shard].some(item=>item.stageEffectIndexSha256!==catalog.sources.effects || item.commandsSha256!==catalog.sources.commands)
    || common.commands?.choreographyIndexSha256!==canonical.sha256 || !sameSong(shard.track,song)
    || 'stagelights' in common.index || 'stagelightSongs' in common.index || 'songs' in common.commands)
    throw Error('Stage effect shard source/identity mismatch')
  const usedModels=modelNames(shard)
  if(!shard.models || Object.keys(shard.models).some(name=>!usedModels.has(name)))
    throw Error('Invalid stage effect shard model scope')
  const index={...common.index,stagelights:shard.models,stagelightSongs:shard.legacySong?{[song.songCode]:shard.legacySong}:{}}
  const effects=attachNativeSuspensionSprites(attachNativeOldSuspension(index,common.oldSuspension,catalog.sources.effects),common.sprites,catalog.sources.effects)
  const commands=validateStagelightData({...common.commands,sourceEventCount:common.commands.eventCount,
    eventCount:shard.track.events.length,songs:{[id]:shard.track}},canonical.sha256)
  return {effects,commands}
}

async function verifiedDocument(transport,value,{signal}={}) {
  const document=await transport.load(value.file,{signal})
  const hash=await document.hash()
  cancelled(signal)
  if(hash!==value.sha256) {
    transport.invalidate(value.file)
    throw Error('Stage effect shard SHA-256 mismatch')
  }
  return document.data
}

export async function loadStageEffectSong(transport,id,{signal,binding}={}) {
  const document=await transport.load(STAGE_EFFECT_CATALOG_URL,{signal})
  const catalog=validateStageEffectCatalog(document.data),song=catalog.songs[id]
  if(!song)throw Error('Unknown stage effect shard')
  const [common,shard]=await Promise.all([verifiedDocument(transport,catalog.common,{signal}),verifiedDocument(transport,song,{signal})])
  cancelled(signal)
  return hydrateStageEffectShard(catalog,common,shard,id,binding)
}

// Compiler and runtime share the native validators and hydration contract.
export function compileStageEffectShards(documents,hash) {
  const sources=Object.fromEntries(Object.entries(documents).map(([key,document])=>[key,hash(document.text)]))
  const effects=documents.effects.data,commands=documents.commands.data
  validateStagelightData(commands,commands.choreographyIndexSha256)
  attachNativeSuspensionSprites(attachNativeOldSuspension(effects,documents.oldSuspension.data,sources.effects),documents.sprites.data,sources.effects)
  const {stagelights,stagelightSongs,...index}=effects
  const {songs,...commandHeader}=commands
  const common={schemaVersion:1,contract:'stage-effect-common-v1',stageEffectIndexSha256:sources.effects,commandsSha256:sources.commands,
    index,commands:commandHeader,oldSuspension:documents.oldSuspension.data,sprites:documents.sprites.data}
  const files=new Map()
  const write=(name,value)=>{
    const text=serializeStageEffectJSON(value)+'\n',sha256=hash(text),file=`${base}${name}.${sha256}.json`
    files.set(file,text);return {file,sha256,bytes:new TextEncoder().encode(text).byteLength}
  }
  const catalog={schemaVersion:1,contract:'stage-effect-shards-v1',sources,choreographyIndexSha256:commands.choreographyIndexSha256,
    common:write('common',common),songs:{}}
  for(const [id,track] of Object.entries(songs)) {
    const shard={schemaVersion:1,contract:'stage-effect-song-v1',stageEffectIndexSha256:sources.effects,commandsSha256:sources.commands,
      id,songCode:track.songCode,source:track.source,track,legacySong:stagelightSongs[track.songCode] || null}
    shard.models=Object.fromEntries([...modelNames(shard)].filter(name=>Object.hasOwn(stagelights,name)).map(name=>[name,stagelights[name]]))
    catalog.songs[id]={id,songCode:track.songCode,source:track.source,...write(id,shard)}
  }
  validateStageEffectCatalog(catalog)
  for(const [id,song] of Object.entries(catalog.songs))hydrateStageEffectShard(catalog,common,JSON.parse(files.get(song.file)),id,
    {sourceBinding:{file:'choreography/index.json',sha256:catalog.choreographyIndexSha256},songs:[song]})
  return {catalog,files}
}
