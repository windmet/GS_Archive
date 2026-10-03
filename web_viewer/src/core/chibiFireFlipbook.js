import { sampleParticleCurve } from './chibiParticleTimeline.js'

export const CHIBI_FIRE_PROFILE = 'knwonl-masked-fire-flipbook-v1'
const asset = 'fx_in_knwonl_panel'
const finite = n => typeof n === 'number' && Number.isFinite(n)
const hash = s => /^[a-f0-9]{64}$/.test(s || '')

export function attachChibiFire(index, model) {
  const original = index?.assets?.[asset]
  const texture = id => model?.textures?.[id]?.pathId === id
    && model.textures[id].serializedFile === model.keeper.serializedFile
    && hash(model.textures[id].pngSha256)
    && /^floor-particles\/[\w.-]+\.png$/.test(model.textures[id].file || '')
  if (model?.profile !== CHIBI_FIRE_PROFILE || model.asset !== asset || original?.kind !== 'particle'
    || model.bundle !== 'song_knwonl.unity3d' || original.bundle !== model.bundle
    || model.particleCount !== 3 || original.particleCount !== 3 || !hash(model.bundleSha256)
    || typeof model.keeper?.pathId !== 'string' || model.systems?.length !== 2
    || model.deferredSystems?.length !== 1 || typeof model.deferredSystems[0].pathId !== 'string'
    || !model.deferredSystems[0].reason || model.mask?.texture !== '-4825635287030208285'
    || !texture(model.mask.texture) || ![model.mask.x,model.mask.y].every(finite)
    || ![model.mask.width,model.mask.height].every(n => finite(n) && n>1409 && n<1411)
    || !model.systems.every(s => s.source?.serializedFile === model.keeper.serializedFile
      && typeof s.source.pathId === 'string' && hash(s.source.parameterTreeSha256)
      && [s.position?.x,s.position?.y,s.position?.z].every(finite)
      && s.period === 1 && s.lifetime === 1 && finite(s.delay) && s.delay>=0 && s.delay<=.11
      && s.size === 14.5 && s.tilesX === 4 && s.tilesY === 2 && s.blend === 'normal'
      && finite(s.sortingOrder) && ['r','g','b','a'].every(k=>finite(s.color?.[k]) && s.color[k]>=0 && s.color[k]<=1)
      && s.texture === '-6399550434419809574' && texture(s.texture)
      && model.textures[s.texture].width===2048 && model.textures[s.texture].height===1024
      && s.uv?.mode===1 && s.uv.scalar===.5 && s.uv.keys?.length===2
      && s.uv.keys.every((k,i)=>k.time===i && k.value===i && k.inSlope===i && k.outSlope===1-i))) return index
  return {...index, assets:{...index.assets, [asset]:{...original, floorAnimation:model}}}
}

// Burst at the start of every native one-second loop. The second emitter
// starts 100ms later. Recompute from the clock, so seeking does not accumulate.
export function sampleFireSystem(system, milliseconds, activatedAt) {
  const elapsed=(milliseconds-activatedAt)/1000-system.delay
  if (elapsed<0) return null
  const age=elapsed%system.period
  if (age>=system.lifetime) return null
  const frames=system.tilesX*system.tilesY
  const frame=Math.floor(sampleParticleCurve(system.uv,age/system.lifetime)*frames)%frames
  return {frame, x:system.position.x*100,y:-system.position.y*100,size:system.size*100,
    color:['r','g','b'].reduce((n,k,i)=>n | (Math.round(system.color[k]*255) << (16-i*8)),0),alpha:system.color.a}
}
