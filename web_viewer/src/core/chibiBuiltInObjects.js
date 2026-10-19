import { attachObjectEmitters } from './chibiObjectEmitters.js'
import { createNativeLightQuad } from './chibiLightQuad.js'

const hash=value=>typeof value==='string' && /^[a-f0-9]{64}$/.test(value)
const shader950='7251f5c686e43bf50d0b4f470c83cc84af5774f867802d249388331ccbc4e4f5'
export function attachBuiltInObjects(index,data,indexHash) {
  if(data?.schemaVersion!==1 || data.contract!=='apk-built-in-objects-v1' || !hash(indexHash)
      || data.objectIndexSha256!==indexHash || !hash(data.unityDataSha256))throw Error('Built-in object source mismatch')
  const assets={...index.assets}
  for(const [name,entry] of Object.entries(data.assets || {})) {
    if(Object.hasOwn(assets,name) || !index.missing?.includes(name) || entry.id!==name
        || entry.bundle!=='apk:resources.assets' || entry.source?.serializedFile!=='resources.assets'
        || !entry.source.pathId || !['particle','sprite'].includes(entry.kind)
        || !Array.isArray(entry.textures) || !Array.isArray(entry.instances))throw Error('Invalid built-in object identity')
    for(const texture of entry.textures) {
      if(!hash(texture.pngSha256) || texture.file!==`/data/stage-built-in-objects/${texture.pngSha256.slice(0,24)}.png`
          || ![texture.pivot?.x,texture.pivot?.y,texture.pixelsPerUnit].every(Number.isFinite)
          || texture.pixelsPerUnit<=0)throw Error('Invalid built-in Sprite texture')
    }
    if(entry.kind==='sprite' && (entry.nativeSpriteShader?.shaderSha256!==shader950
        || entry.nativeSpriteShader.shaderPathId!==950 || entry.spriteCount!==entry.instances.length
        || entry.instances.some(s=>!entry.textures.some(t=>t.id===s.texture)
          || s.blendMode!=='native-additive-950'
          || ![s.x,s.y,s.scaleX,s.scaleY,s.rotation,s.skewX,s.tint,s.alpha,s.sortingOrder].every(Number.isFinite))))
      throw Error('Invalid built-in Sprite material/geometry')
    assets[name]=entry
  }
  const attached=attachObjectEmitters({...index,assets},data.emitters,indexHash)
  for(const name of Object.keys(data.assets || {}))
    if(attached.assets[name].kind==='particle' && !attached.assets[name].nativeParticleAnimation)
      throw Error('Built-in particle has no consumer')
  return {...attached,missing:(index.missing || []).filter(name=>!Object.hasOwn(data.assets,name)),builtInObjectSource:data.unityDataSha256}
}

export async function loadBuiltInObjectSprites(PIXI,renderer,entry,loadTexture) {
  const results=await Promise.allSettled(entry.textures.map(async metadata=>({metadata,texture:await loadTexture(metadata.file)})))
  const loaded=results.filter(r=>r.status==='fulfilled').map(r=>r.value)
  if(results.some(r=>r.status==='rejected')) {
    for(const row of loaded)row.texture.destroy(true)
    throw results.find(r=>r.status==='rejected').reason
  }
  const container=new PIXI.Container(),meshes=[]
  container.sortableChildren=true
  const releaseNativeMaterials=()=>{for(const mesh of meshes)mesh.shader.destroy()}
  try {
    for(const instance of entry.instances) {
      const {texture,metadata}=loaded.find(row=>row.metadata.id===instance.texture)
      const mesh=createNativeLightQuad(PIXI,renderer,texture,metadata.pivot.x,metadata.pivot.y)
      meshes.push(mesh);container.addChild(mesh)
      mesh.position.set(instance.x,instance.y)
      mesh.scale.set(instance.scaleX*100/metadata.pixelsPerUnit,instance.scaleY*100/metadata.pixelsPerUnit)
      mesh.rotation=instance.rotation*Math.PI/180;mesh.skew.set(instance.skewX*Math.PI/180,0)
      mesh.tint=instance.tint;mesh.alpha=instance.alpha;mesh.zIndex=instance.sortingOrder
    }
    return {container,textures:loaded.map(row=>row.texture),nativeBuiltInSprites:meshes,releaseNativeMaterials,entry}
  } catch(error) {
    releaseNativeMaterials();container.destroy({children:true})
    for(const row of loaded)row.texture.destroy(true)
    throw error
  }
}
