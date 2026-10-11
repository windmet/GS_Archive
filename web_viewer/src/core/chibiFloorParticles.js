import { sampleParticleCurve } from './chibiParticleTimeline.js'
import { CHIBI_FIRE_PROFILE, attachChibiFire, sampleFireSystem } from './chibiFireFlipbook.js'

export const CHIBI_FLOOR_PROFILE = 'take-masked-nebula-reference-v1'
export const CHIBI_BOX_FLOOR_PROFILE = 'continuous-masked-box-floor-v1'
export const CHIBI_VOLUME_FLOOR_PROFILE = 'continuous-masked-volume-floor-v1'
export const CHIBI_DIRECTED_BOX_FLOOR_PROFILE = 'continuous-masked-directed-box-floor-v1'
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
  if (milliseconds < activatedAt) return []
  const elapsed = (milliseconds - activatedAt) / 1000 + (system.prewarmSeconds || 0)
  const last = Math.floor(elapsed * system.rate), seed = seedOf(system.source.pathId)
  const first = Math.max(0, last - Math.ceil(Math.max(system.lifetime.scalar, system.lifetime.minScalar) * system.rate))
  const particles = []
  for (let birth = first; birth <= last; birth++) {
    const rnd = channel => random(birth, channel, seed)
    const lifetime = range(system.lifetime, rnd(0)), age = elapsed - birth / system.rate
    if (age < 0 || age >= lifetime) continue
    const fraction = age / lifetime, colorPosition = rnd(1)
    const color = [16, 8, 0].reduce((value, shift, channel) => value |
      (Math.round(sampleFloorGradient(system.color.colors, colorPosition, ['r','g','b'][channel]) * 255
        * (system.colorOverLife ? sampleFloorGradient(system.colorOverLife.colors,fraction,['r','g','b'][channel]) : 1)) << shift), 0)
    const startAlpha = sampleFloorGradient(system.color.alphas, colorPosition)
    let x=(rnd(2)-.5)*system.shape.x, y=(rnd(3)-.5)*system.shape.y
    if (system.directedBox) {
      // Rotate native XYZ box coordinates around X by -90 degrees:
      // its Z extent becomes screen Y, and forward velocity becomes +Y.
      y=(rnd(7)-.5)*system.shape.z+range(system.speedParameters,rnd(8))*age
    }
    if (system.shapeType===0) {
      // Uniform sphere volume, projected onto XY. Keep Z in the direction
      // distribution, rather than replacing the sphere with a uniform disk.
      const z=rnd(7)*2-1, angle=rnd(2)*Math.PI*2, radial=Math.sqrt(1-z*z)
      const dx=Math.cos(angle)*radial,dy=Math.sin(angle)*radial
      const radius=Math.cbrt(rnd(3))*system.radius, speed=range(system.speedParameters,rnd(8))
      x=dx*radius*system.shape.x+dx*speed*age
      y=dy*radius*system.shape.y+dy*speed*age
    }
    particles.push({ birth,
      x: (system.position.x + x) * 100,
      y: -(system.position.y + y) * 100,
      frame:system.frameRange ? Math.min(15,Math.floor(range(system.frameRange,rnd(9))*16)) : system.frame,
      size: range(system.size, rnd(4)) * 100 * (system.sizeOverLife ? sampleParticleCurve(system.sizeOverLife, fraction) : 1),
      rotation: -(range(system.rotation, rnd(5)) + (system.angularVelocity ? range(system.angularVelocity, rnd(6)) * age : 0)),
      color, alpha: startAlpha * sampleFloorGradient(system.alpha, fraction) })
  }
  // The native maximum is per emitter; older births are retired first.
  return particles.slice(-system.capacity)
}

export function attachChibiFloor(objectIndex, model) {
  if (model?.schemaVersion === 2) {
    let index = objectIndex
    for (const entry of Object.values(model.assets || {})) {
      index = entry.profile === CHIBI_FLOOR_PROFILE ? attachChibiFloor(index,entry)
        : entry.profile === CHIBI_FIRE_PROFILE ? attachChibiFire(index,entry) : attachBoxFloor(index,entry)
    }
    return index
  }
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

function attachBoxFloor(index, model) {
  const directed=model?.profile===CHIBI_DIRECTED_BOX_FLOOR_PROFILE
  const volume=directed || model?.profile===CHIBI_VOLUME_FLOOR_PROFILE
  const original = index?.assets?.[model?.asset]
  const finite = n => typeof n === 'number' && Number.isFinite(n)
  const hash = s => /^[a-f0-9]{64}$/.test(s || '')
  const curve = c => c && [0,1,3].includes(c.mode) && finite(c.scalar) && finite(c.minScalar)
    && Array.isArray(c.keys) && (c.mode !== 1 || c.keys.length > 0)
    && c.keys.every((k,i,a) => [k.time,k.value,k.inSlope,k.outSlope].every(finite) && (!i || k.time > a[i-1].time))
  const gradient = (g,props) => Array.isArray(g) && g.length >= 2 && g.every((k,i,a) =>
    finite(k.time) && k.time>=0 && k.time<=1 && (!i || k.time>a[i-1].time)
    && props.every(p=>finite(k[p]) && k[p]>=0 && k[p]<=1))
  const colors = g => gradient(g?.colors,['r','g','b']) && gradient(g?.alphas,['value'])
  const texture = id => model?.textures?.[id]?.pathId===id
    && model.textures[id].serializedFile===model.keeper.serializedFile
    && hash(model.textures[id].pngSha256) && /^floor-particles\/[\w.-]+\.png$/.test(model.textures[id].file || '')
    && [model.textures[id].width,model.textures[id].height].every(n=>Number.isInteger(n) && n>0 && n<=4096)
  const validMask = m => m && texture(m.texture) && [m.x,m.y].every(finite)
    && [m.width,m.height].every(n=>finite(n) && n>0 && n<=2500)
  if ((!volume && model?.profile !== CHIBI_BOX_FLOOR_PROFILE) || original?.kind !== 'particle'
    || original.bundle !== model.bundle || original.particleCount !== model.particleCount
    || !hash(model.bundleSha256) || typeof model.keeper?.pathId !== 'string'
    || !Array.isArray(model.systems) || !model.systems.length || model.systems.length!==model.particleCount
    || (model.maskGroups && (!directed || Object.keys(model.maskGroups).length>8
      || !Object.entries(model.maskGroups).every(([id,m])=>id===m.texture && validMask(m))
      || !model.systems.every(s=>model.maskGroups[s.maskTexture])))
    || !model.mask || !texture(model.mask.texture) || ![model.mask.x,model.mask.y].every(finite)
    || ![model.mask.width,model.mask.height].every(n=>finite(n) && n>0 && n<=2500)
    || model.systems.reduce((n,s)=>n+s.capacity,0)>(volume ? 2048 : 512)
    || !model.systems.every(s=> s.source?.serializedFile===model.keeper.serializedFile
      && typeof s.source.pathId==='string' && hash(s.source.parameterTreeSha256)
      && Number.isInteger(s.capacity) && s.capacity>0 && s.capacity<=(volume ? 1024 : 250)
      && finite(s.rate) && s.rate>0 && s.rate<=(volume ? 1000 : 250) && [s.position?.x,s.position?.y,s.shape?.x,s.shape?.y].every(finite)
      && s.shape.x>=0 && s.shape.y>=0 && curve(s.size) && [0,3].includes(s.size.mode) && s.size.scalar>0
      && curve(s.rotation) && [0,3].includes(s.rotation.mode) && curve(s.lifetime) && [0,3].includes(s.lifetime.mode)
      && s.lifetime.scalar>0 && s.lifetime.scalar<=10 && (s.lifetime.mode!==3 || s.lifetime.minScalar>0)
      && (!s.sizeOverLife || curve(s.sizeOverLife)) && (!s.angularVelocity || curve(s.angularVelocity))
      && colors(s.color) && colors(s.colorOverLife) && [0,4].includes(s.colorMode) && gradient(s.alpha,['value'])
      && texture(s.texture) && (s.frame===null || Number.isInteger(s.frame) && s.frame>=0 && s.frame<16)
      && finite(s.sortingOrder) && finite(s.prewarmSeconds) && s.prewarmSeconds>=0 && s.prewarmSeconds<=10
      && s.noiseParameters===null && (volume
        ? [0,5].includes(s.shapeType) && finite(s.radius) && s.radius>0 && s.radius<=10
          && curve(s.speedParameters) && [0,3].includes(s.speedParameters.mode)
          && (s.directedBox
            ? directed && s.shapeType===5 && finite(s.shape.z) && s.shape.z>=0
              && s.speedParameters.minScalar>=0 && s.speedParameters.scalar>=s.speedParameters.minScalar
              && s.speedParameters.scalar<=3
            : Math.max(Math.abs(s.speedParameters.scalar),Math.abs(s.speedParameters.minScalar))<=2)
          && (!s.frameRange || curve(s.frameRange) && [0,3].includes(s.frameRange.mode)
            && [s.frameRange.scalar,s.frameRange.minScalar].every(n=>n>=0 && n<=1))
        : s.speedParameters?.mode===0 && s.speedParameters.scalar===0))) return index
  return {...index,assets:{...index.assets,[model.asset]:{...original,floorAnimation:model}}}
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
    const groups=new Map()
    for(const model of Object.values(animation.maskGroups || {default:animation.mask})) {
      const group=animation.maskGroups ? new PIXI.Container() : content
      group.sortableChildren=true
      if(animation.maskGroups)content.addChild(group)
      const mask = new PIXI.Sprite(byId.get(model.texture))
      mask.anchor.set(.5); mask.position.set(model.x,model.y)
      mask.width=model.width; mask.height=model.height
      container.addChild(mask); group.mask=mask;groups.set(model.texture,group)
    }
    const emitters = animation.systems.map(system => {
      const emitterContent=groups.get(system.maskTexture || animation.mask.texture)
      let texture = byId.get(system.texture)
      if (animation.profile === CHIBI_FIRE_PROFILE) {
        const metadata=animation.textures[system.texture], w=metadata.width/system.tilesX,h=metadata.height/system.tilesY
        const frames=Array.from({length:system.tilesX*system.tilesY},(_,i)=>{
          const frame=new PIXI.Texture(texture.baseTexture,new PIXI.Rectangle(i%system.tilesX*w,Math.floor(i/system.tilesX)*h,w,h))
          frameTextures.push(frame);return frame
        })
        const sprite=new PIXI.Sprite(frames[0]);sprite.anchor.set(.5);sprite.zIndex=system.sortingOrder
        sprite.blendMode=PIXI.BLEND_MODES.NORMAL;sprite.visible=false;emitterContent.addChild(sprite)
        return {system,sprites:[sprite],fireFrames:frames}
      }
      let atlasFrames=null
      if (system.frameRange) {
        const metadata=animation.textures[system.texture], w=metadata.width/4,h=metadata.height/4
        atlasFrames=Array.from({length:16},(_,i)=>{
          const frame=new PIXI.Texture(texture.baseTexture,new PIXI.Rectangle(i%4*w,Math.floor(i/4)*h,w,h))
          frameTextures.push(frame);return frame
        })
        texture=atlasFrames[0]
      } else if (system.frame !== null) {
        const metadata=animation.textures[system.texture], w=metadata.width/4,h=metadata.height/4
        texture=new PIXI.Texture(texture.baseTexture,new PIXI.Rectangle(system.frame%4*w,Math.floor(system.frame/4)*h,w,h))
        frameTextures.push(texture)
      }
      const sprites=Array.from({length:system.capacity},()=>{
        const s=new PIXI.Sprite(texture); s.anchor.set(.5); s.blendMode=PIXI.BLEND_MODES.ADD
        s.zIndex=system.sortingOrder; s.visible=false; emitterContent.addChild(s);return s
      })
      return {system,sprites,atlasFrames}
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
  for(const {system,sprites,fireFrames,atlasFrames} of runtime.floorEmitters) {
    if (fireFrames) {
      const sample=sampleFireSystem(system,milliseconds,activatedAt),sprite=sprites[0]
      sprite.visible=Boolean(sample && sample.alpha>.001)
      if(sample) {
        sprite.texture=fireFrames[sample.frame];sprite.position.set(sample.x,sample.y)
        sprite.width=sprite.height=sample.size;sprite.tint=sample.color;sprite.alpha=sample.alpha
      }
      signatures.push(`fire:${sample?.frame ?? 'off'}`)
      continue
    }
    const samples=sampleFloorSystem(system,milliseconds,activatedAt)
    for(let i=0;i<sprites.length;i++) {
      const sprite=sprites[i], sample=samples[i]; sprite.visible=Boolean(sample && sample.alpha > .001)
      if(!sample)continue
      if(atlasFrames)sprite.texture=atlasFrames[sample.frame]
      sprite.position.set(sample.x,sample.y);sprite.width=sprite.height=sample.size
      sprite.rotation=sample.rotation;sprite.tint=sample.color;sprite.alpha=sample.alpha
    }
    signatures.push(`${samples.length}:${samples.slice(0,3).map(s=>`${s.birth}/${s.alpha.toFixed(3)}/${s.size.toFixed(2)}`).join(';')}`)
  }
  runtime.floorSignature=signatures.join('|')
}
