import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { attachChibiFloor } from '../src/core/chibiFloorParticles.js'
import { attachChibiParticleLayers } from '../src/core/chibiParticleTimeline.js'
import { buildStageVfxCoverage } from '../src/core/stageVfxCoverage.js'

const root=fileURLToPath(new URL('../',import.meta.url)), assetRoot=path.join(root,'public/assets/live-chibi')
const arg=process.argv.indexOf('--output')
if(arg<0 || !process.argv[arg+1]) throw new Error('--output is required; this report is source evidence, not Browser acceptance')
const output=path.resolve(process.argv[arg+1])
if(output.startsWith(path.join(root,'public')+path.sep)) throw new Error('Audit report must stay outside published media')
const sources={}
function json(name) {
  const bytes=fs.readFileSync(path.join(assetRoot,name))
  sources[name]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}
  return JSON.parse(bytes)
}
const songs=json('choreography/index.json').songs
const floor=json('floor-particles/index.json'),stageEffects=json('stage-effects/index.json')
const objects=attachChibiFloor(attachChibiParticleLayers(json('object-layers/index.json'),json('particle-layers/index.json')),floor)
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
    sourceLightingChannels:{spotlight:song.spotlightEvents?.length || 0,pinspotlight:song.pinspotlightEvents?.length || 0,
      laserlight:song.laserlightEvents?.length || 0,wholeScreenColor:song.wholeScreenColorLayerEvents?.length || 0,
      imageColor:song.imageColorEvents?.length || 0},
    status:'source_inventory_not_visual_acceptance'}
})
const report={schemaVersion:1,status:'partial_native_profiles_not_all_song_acceptance',sources,
  counts:{arrangements:records.length,nativeFixedLampTracks:Object.keys(stageEffects.stagelightSongs || {}).length,
    registeredFloorObjects:Object.values(objects.assets).filter(a=>a.floorAnimation).length,
    arrangementsWithFloor:records.filter(r=>r.floorProfiles.length).length},
  lampInventory:stageEffects.stagelightInventory,floorInventory:floor.inventory,records}
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report.counts))
