import { sampleParticleCurve } from './chibiParticleTimeline.js'

export const CHIBI_FLOOR_PROFILE = 'take-masked-nebula-reference-v1'
const asset = 'fx_in_tkstp1_panel_1'
const random = (birth, channel, seed) => {
  let n = Math.imul(birth + 1, 0x45d9f3b) ^ Math.imul(channel + 1, 0x27d4eb2d) ^ seed
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}
const seedOf = id => [...id].reduce((n, c) => Math.imul(n, 31) + c.charCodeAt(0) | 0, 7)
function range(curve, r) {
  return curve.mode === 3 ? curve.minScalar + (curve.scalar - curve.minScalar) * r : curve.scalar
}
export function sampleFloorGradient(keys, time, property = 'value') {
  if (time <= keys[0].time) return keys[0][property]
  if (time >= keys.at(-1).time) return keys.at(-1)[property]
  const end = keys.findIndex(k => k.time > time), a = keys[end - 1], b = keys[end]
  const t = (time - a.time) / (b.time - a.time)
  return a[property] * (1 - t) + b[property] * t
}

// Reproducible browser seeds make backwards seeks stable. Native autoRandomSeed
// and NoiseModule are retained in the source model but are not Unity RNG/noise.
export function sampleFloorSystem(system, milliseconds, activatedAt) {
  const elapsed = (milliseconds - activatedAt) / 1000
  if (elapsed < 0) return []
  const last = Math.floor(elapsed * system.rate), seed = seedOf(system.source.pathId)
  const first = Math.max(0, last - Math.ceil(Math.max(system.lifetime.scalar, system.lifetime.minScalar) * system.rate))
  const particles = []
  for (let birth = first; birth <= last; birth++) {
    const rnd = channel => random(birth, channel, seed)
    const lifetime = range(system.lifetime, rnd(0)), age = elapsed - birth / system.rate
    if (age < 0 || age >= lifetime) continue
    const fraction = age / lifetime, colorPosition = rnd(1)
    const color = [16, 8, 0].reduce((value, shift, channel) => value |
      (Math.round(sampleFloorGradient(system.color.colors, colorPosition, ['r','g','b'][channel]) * 255) << shift), 0)
    const startAlpha = sampleFloorGradient(system.color.alphas, colorPosition)
    particles.push({ birth,
      x: (system.position.x + (rnd(2) - .5) * system.shape.x) * 100,
      y: -(system.position.y + (rnd(3) - .5) * system.shape.y) * 100,
      size: range(system.size, rnd(4)) * 100 * (system.sizeOverLife ? sampleParticleCurve(system.sizeOverLife, fraction) : 1),
      rotation: -(range(system.rotation, rnd(5)) + (system.angularVelocity ? range(system.angularVelocity, rnd(6)) * age : 0)),
      color, alpha: startAlpha * sampleFloorGradient(system.alpha, fraction) })
  }
  // The native maximum is per emitter; older births are retired first.
  return particles.slice(-system.capacity)
}

export function attachChibiFloor(objectIndex, model) {
  const original = objectIndex?.assets?.[asset]
  const finite = n => typeof n === 'number' && Number.isFinite(n)
  const curve = c => c && [0,1,3].includes(c.mode) && finite(c.scalar) && finite(c.minScalar)
    && Array.isArray(c.keys) && (c.mode !== 1 || c.keys.length > 0)
    && c.keys.every((k,i,a) => [k.time,k.value,k.inSlope,k.outSlope].every(finite) && (!i || k.time > a[i-1].time))
  const gradient = (keys, props) => Array.isArray(keys) && keys.length >= 2 && keys.every((k,i,a) =>
    finite(k.time) && k.time >= 0 && k.time <= 1 && (!i || k.time > a[i-1].time)
    && props.every(p => finite(k[p]) && k[p] >= 0 && k[p] <= 1))
  const texture = id => model?.textures?.[id]?.pathId === id
    && model.textures[id].serializedFile === model.keeper.serializedFile
    && /^[a-f0-9]{64}$/.test(model.textures[id].pngSha256 || '')
    && /^floor-particles\/[\w.-]+\.png$/.test(model.textures[id].file || '')
  if (original?.kind !== 'particle' || original.bundle !== 'song_tkstp1.unity3d' || original.particleCount !== 4
    || model?.profile !== CHIBI_FLOOR_PROFILE || model.asset !== asset || model.bundle !== original.bundle
    || !/^[a-f0-9]{64}$/.test(model.bundleSha256 || '') || typeof model.keeper?.pathId !== 'string'
    || model.mask?.texture !== '8211287001986913246' || !texture(model.mask.texture)
    || ![model.mask.x,model.mask.y].every(finite) || model.mask.width !== 1525 || model.mask.height !== 1525
    || model.systems?.length !== 4 || model.particleCount !== 4
    || !model.systems.every((s,i) => s.source?.serializedFile === model.keeper.serializedFile
      && typeof s.source.pathId === 'string' && /^[a-f0-9]{64}$/.test(s.source.parameterTreeSha256 || '')
      && s.capacity === [150,80,7,7][i] && s.rate === [200,50,3,3][i]
      && [s.position?.x,s.position?.y,s.shape?.x,s.shape?.y].every(finite)
      && curve(s.size) && curve(s.rotation) && curve(s.lifetime) && s.lifetime.scalar > 0 && s.lifetime.scalar <= 2
      && (!s.sizeOverLife || curve(s.sizeOverLife)) && (!s.angularVelocity || curve(s.angularVelocity))
      && gradient(s.alpha,['value']) && gradient(s.color?.colors,['r','g','b']) && gradient(s.color?.alphas,['value'])
      && texture(s.texture) && (s.frame === null || Number.isInteger(s.frame) && s.frame >= 0 && s.frame < 16))) return objectIndex
  return {...objectIndex,assets:{...objectIndex.assets,[asset]:{...original,floorAnimation:model}}}
}

export async function loadChibiFloor(PIXI, animation, loadTexture) {
  const ids = Object.keys(animation.textures)
  const results = await Promise.allSettled(ids.map(id => loadTexture(animation.textures[id].file)))
  if (results.some(r => r.status === 'rejected')) {
    for (const r of results) if (r.status === 'fulfilled') r.value.destroy(true)
    throw results.find(r => r.status === 'rejected').reason
  }
  const textures = results.map(r => r.value), byId = new Map(ids.map((id,i)=>[id,textures[i]]))
  const container = new PIXI.Container(), content = new PIXI.Container(), frameTextures = []
  try {
    content.sortableChildren = true
    container.addChild(content)
    const mask = new PIXI.Sprite(byId.get(animation.mask.texture))
    mask.anchor.set(.5); mask.position.set(animation.mask.x,animation.mask.y)
    mask.width=animation.mask.width; mask.height=animation.mask.height
    container.addChild(mask); content.mask=mask
    const emitters = animation.systems.map(system => {
      let texture = byId.get(system.texture)
      if (system.frame !== null) {
        const metadata=animation.textures[system.texture], w=metadata.width/4,h=metadata.height/4
        texture=new PIXI.Texture(texture.baseTexture,new PIXI.Rectangle(system.frame%4*w,Math.floor(system.frame/4)*h,w,h))
        frameTextures.push(texture)
      }
      const sprites=Array.from({length:system.capacity},()=>{
        const s=new PIXI.Sprite(texture); s.anchor.set(.5); s.blendMode=PIXI.BLEND_MODES.ADD
        s.zIndex=system.sortingOrder; s.visible=false; content.addChild(s);return s
      })
      return {system,sprites}
    })
    return {container,textures,frameTextures,floorEmitters:emitters,floorSignature:'',destroyed:false}
  } catch(error) {
    container.destroy({children:true})
    for(const t of frameTextures)t.destroy(false)
    for(const t of textures)t.destroy(true)
    throw error
  }
}

export function updateChibiFloor(runtime,milliseconds,activatedAt) {
  const signatures=[]
  for(const {system,sprites} of runtime.floorEmitters) {
    const samples=sampleFloorSystem(system,milliseconds,activatedAt)
    for(let i=0;i<sprites.length;i++) {
      const sprite=sprites[i], sample=samples[i]; sprite.visible=Boolean(sample && sample.alpha > .001)
      if(!sample)continue
      sprite.position.set(sample.x,sample.y);sprite.width=sprite.height=sample.size
      sprite.rotation=sample.rotation;sprite.tint=sample.color;sprite.alpha=sample.alpha
    }
    signatures.push(`${samples.length}:${samples.slice(0,3).map(s=>`${s.birth}/${s.alpha.toFixed(3)}/${s.size.toFixed(2)}`).join(';')}`)
  }
  runtime.floorSignature=signatures.join('|')
}
