import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { attachChibiFloor } from '../src/core/chibiFloorParticles.js'
import { attachChibiParticleLayers } from '../src/core/chibiParticleTimeline.js'
import { buildStageVfxCoverage } from '../src/core/stageVfxCoverage.js'
import { attachObjectEmitters } from '../src/core/chibiObjectEmitters.js'
import { attachBuiltInObjects } from '../src/core/chibiBuiltInObjects.js'
import { attachBloom } from '../src/core/chibiBloomParticles.js'

const root=fileURLToPath(new URL('../',import.meta.url)), assetRoot=path.join(root,'public/assets/live-chibi')
const arg=process.argv.indexOf('--output')
if(arg<0 || !process.argv[arg+1]) throw new Error('--output is required; this report is source evidence, not Browser acceptance')
const output=path.resolve(process.argv[arg+1])
if(output.startsWith(path.join(root,'public')+path.sep)) throw new Error('Audit report must stay outside published media')
const sources={}
function json(name,base=assetRoot) {
  const bytes=fs.readFileSync(path.join(base,name))
  sources[name]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}
  return JSON.parse(bytes)
}
const songs=json('choreography/index.json').songs
const floor=json('floor-particles/index.json'),stageEffects=json('stage-effects/index.json')
const publicData=path.join(root,'public/data')
const rawObjects=json('object-layers/index.json'),objectHash=sources['object-layers/index.json'].sha256
let objects=attachObjectEmitters(rawObjects,json('stage-object-emitters.json',publicData),objectHash,sources['choreography/index.json'].sha256)
objects=attachBuiltInObjects(objects,json('stage-built-in-objects.json',publicData),objectHash)
objects=attachChibiFloor(attachChibiParticleLayers(objects,json('particle-layers/index.json')),floor)
objects=attachBloom(objects,json('stage-bloom-particles.json',publicData),objectHash)
const indexes={objectLayers:objects,stageEffects,backmonitor:json('backmonitor/index.json'),imageLayers:json('image-layers/index.json'),
  imageObjects:json('image-objects/index.json'),stageBackgrounds:json('stage-backgrounds/index.json')}
const records=songs.map(song=>{
  const coverage=buildStageVfxCoverage(song,indexes),track=stageEffects.stagelightSongs?.[song.songCode]
  return {id:song.id,title:song.title,songCode:song.songCode,
    nativeFixedLampCommands:track?.events.length || 0,
    supportedFixedLampCommands:track?.events.filter(e=>!e.hide && e.previewSupported!==false).length || 0,
    unresolvedFixedLampCommands:coverage.stagelightUnimplementedCommands,
    unresolvedFixedLampAssets:coverage.stagelightUnimplemented,
    floorProfiles:coverage.objectParticles.filter(a=>objects.assets[a]?.floorAnimation).map(a=>({asset:a,profile:objects.assets[a].floorAnimation.profile})),
    unsupportedParticleObjects:coverage.objectParticleUnimplemented,
    partialParticleObjects:coverage.objectParticlePartial,
    particleConsumers:coverage.objectParticleConsumers,
    sourceLightingChannels:{spotlight:song.spotlightEvents?.length || 0,pinspotlight:song.pinspotlightEvents?.length || 0,
      laserlight:song.laserlightEvents?.length || 0,wholeScreenColor:song.wholeScreenColorLayerEvents?.length || 0,
      imageColor:song.imageColorEvents?.length || 0},
    status:'source_inventory_not_visual_acceptance'}
})
const missingAssets=[...new Set(records.flatMap(r=>r.unsupportedParticleObjects))].sort()
const missingEvents=songs.flatMap(song=>(song.objectLayerEvents||[]).filter(e=>missingAssets.includes(e.asset)).map(event=>({arrangement:song.id,event})))
const report={schemaVersion:1,status:'partial_native_profiles_not_all_song_acceptance',sources,
  counts:{arrangements:records.length,nativeFixedLampTracks:Object.keys(stageEffects.stagelightSongs || {}).length,
    registeredFloorObjects:Object.values(objects.assets).filter(a=>a.floorAnimation).length,
    arrangementsWithFloor:records.filter(r=>r.floorProfiles.length).length,
    missingParticleAssets:missingAssets.length,missingParticleEvents:missingEvents.length,
    arrangementsWithMissingParticles:records.filter(r=>r.unsupportedParticleObjects.length).length},
  missingParticles:missingAssets.map(asset=>({asset,bundle:objects.assets[asset]?.bundle,particleCount:objects.assets[asset]?.particleCount,
    events:missingEvents.filter(e=>e.event.asset===asset)})),
  lampInventory:stageEffects.stagelightInventory,floorInventory:floor.inventory,records}
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report.counts))
