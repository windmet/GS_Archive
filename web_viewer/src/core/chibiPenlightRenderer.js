import { compilePenlightModel, penlightMeshInput, penlightActorMatrix, penlightScreenMatrix } from './chibiPenlights.js'

export function createPenlightRuntime(PIXI, model, prefabName, textures, parent) {
  const prefab=compilePenlightModel(model).get(prefabName)
  if(!prefab)throw Error('Unknown native Penlight prefab')
  const geometries=new Map(),draws=[]
  try {
    for(const [kind,renderers] of [['actor',prefab.actors],['shadow',prefab.shadows]])for(const renderer of renderers) {
      const sprite=model.sprites[renderer.spriteKey]
      const textureKey=`${sprite.texture.serializedFile}:${sprite.texture.pathId}`
      const texture=textures.get(textureKey)
      if(!texture)throw Error('Missing bound Penlight texture')
      if(!geometries.has(renderer.spriteKey)) {
        const input=penlightMeshInput(sprite,texture)
        geometries.set(renderer.spriteKey,new PIXI.MeshGeometry(input.vertices,input.uvs,input.indices))
      }
      const material=new PIXI.MeshMaterial(texture)
      let mesh
      try {mesh=new PIXI.Mesh(geometries.get(renderer.spriteKey),material)}
      catch(error) {material.destroy();throw error}
      mesh.visible=false;mesh.zIndex=renderer.sortingOrder
      draws.push({kind,renderer,mesh,material,matrix:new PIXI.Matrix()})
    }
    // Unity sorting order first, then orthographic distance. The tight meshes
    // remain separate renderers so stage/actor planes can interleave normally.
    draws.sort((a,b)=>a.renderer.sortingOrder-b.renderer.sortingOrder || b.renderer.world.z-a.renderer.world.z)
    for(const draw of draws)parent.addChild(draw.mesh)
    return {prefab,draws,geometries}
  } catch(error) {
    releasePenlightRuntime({draws,geometries})
    throw error
  }
}
export function applyPenlightRuntime(runtime, state, time, width, height, environmentScale=1) {
  let rendered=0
  for(const draw of runtime.draws) {
    const {renderer,mesh}=draw,actor=draw.kind==='actor'
    const native=actor?penlightActorMatrix(renderer,state,time):renderer.world
    const value=penlightScreenMatrix(native,state,width,height,environmentScale)
    draw.matrix.set(value.a,value.b,value.c,value.d,value.tx,value.ty)
    mesh.transform.setFromMatrix(draw.matrix)
    const color=actor?state.colors[renderer.index]:renderer.initialColor
    draw.material.tint=color.slice(0,3);mesh.alpha=color[3]
    mesh.zIndex=actor && state.depth!==null?state.depth:renderer.sortingOrder
    mesh.visible=renderer.enabled && color[3]>0
    if(mesh.visible)rendered++
  }
  return rendered
}
export function releasePenlightRuntime(runtime) {
  for(const draw of runtime.draws) {
    draw.mesh.removeFromParent();draw.mesh.destroy();draw.material.destroy()
  }
  for(const geometry of runtime.geometries.values())geometry.destroy()
  runtime.draws.length=0;runtime.geometries.clear()
}
