import { emitterMatrix, sampleObjectEmitter } from './chibiObjectEmitters.js'
import { configureNativeParticleTexture, bindNativeParticleMask } from './chibiNativeParticleMask.js'

export async function loadObjectEmitters(PIXI,model,loadTexture) {
  const ids=new Set(model.systems.flatMap(s=>[s.texture,s.maskTexture].filter(Boolean)))
  const results=await Promise.allSettled([...ids].map(async id=> {
    const texture=await loadTexture(model.textures[id].file)
    configureNativeParticleTexture(texture,model.textures[id].nativeSampling)
    return [id,texture]
  }))
  const loaded=results.filter(r=>r.status==='fulfilled').map(r=>r.value)
  if(results.some(r=>r.status==='rejected')){for(const [,t] of loaded)t.destroy(true);throw results.find(r=>r.status==='rejected').reason}
  const textures=new Map(loaded),container=new PIXI.Container(),frameTextures=[],masks=new Map()
  try {
    for(const mask of model.masks) {
      const texture=textures.get(mask.texture);if(!texture)continue
      const sprite=new PIXI.Sprite(texture),m=emitterMatrix(mask.chain)
      sprite.anchor.set(.5);sprite.renderable=false
      sprite.transform.setFromMatrix(new PIXI.Matrix(m.a*100/texture.width,-m.b*100/texture.width,-m.c*100/texture.height,m.d*100/texture.height,m.tx*100,-m.ty*100))
      container.addChild(sprite);masks.set(mask.texture,sprite)
    }
    const nativeEmitters=model.systems.map(system=> {
      const texture=textures.get(system.texture),cols=system.uv?.columns||1,rows=system.uv?.rows||1,w=texture.width/cols,h=texture.height/rows
      const frames=Array.from({length:cols*rows},(_,i)=>new PIXI.Texture(texture.baseTexture,new PIXI.Rectangle(i%cols*w,Math.floor(i/cols)*h,w,h)))
      frameTextures.push(...frames)
      const sprites=Array.from({length:system.capacity},()=> {
        const sprite=new PIXI.Sprite(frames[0]);sprite.anchor.set(.5);sprite.visible=false;sprite.zIndex=system.sortingOrder
        sprite.blendMode=system.blend==='normal'?PIXI.BLEND_MODES.NORMAL_NPM:PIXI.BLEND_MODES.ADD_NPM
        if(system.maskTexture || system.blend==='add')bindNativeParticleMask(sprite,{sprite:system.maskTexture?masks.get(system.maskTexture):null,kind:system.blend,materialTint:system.materialTint})
        container.addChild(sprite);return sprite
      })
      return {system,frames,sprites,w,h}
    })
    return {container,nativeEmitters,textures:[...textures.values()],frameTextures,nativeParticleCount:0,destroyed:false}
  } catch(error) {
    container.destroy({children:true});for(const t of frameTextures)t.destroy(false);for(const t of textures.values())t.destroy(true);throw error
  }
}

export function updateObjectEmitters(PIXI,runtime,time,activatedAt,stoppedAt,cameraRotation,viewHeight=7.2,spatial=null,sampleEmitter=sampleObjectEmitter) {
  let count=0
  for(const {system,frames,sprites,w,h} of runtime.nativeEmitters) {
    const samples=sampleEmitter(system,time,activatedAt,stoppedAt,{rotation:cameraRotation,height:viewHeight,spatial})
    for(let i=0;i<sprites.length;i++) {
      const sprite=sprites[i],s=samples[i];sprite.visible=Boolean(s && s.alpha>0)
      if(!s)continue
      let {a,b,c,d}=s
      if(system.alignment===0&&!system.stretch){const cos=Math.cos(-cameraRotation),sin=Math.sin(-cameraRotation);[a,b,c,d]=[cos*a-sin*b,sin*a+cos*b,cos*c-sin*d,sin*c+cos*d]}
      sprite.texture=frames[s.frame];sprite.transform.setFromMatrix(new PIXI.Matrix(a/w,b/w,c/h,d/h,s.x,s.y));sprite.alpha=s.alpha;sprite.tint=s.color;count++
    }
  }
  runtime.nativeParticleCount=count
}
