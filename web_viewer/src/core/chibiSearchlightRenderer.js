import { createSpotlightSpriteStore } from './chibiSpotlightSprites.js'
import { createNativeLightQuad } from './chibiLightQuad.js'

export function createSearchlightRenderer(PIXI,parent,onReady,getRenderer) {
  const store=createSpotlightSpriteStore({layerCount:1,
    loadTexture:async file=> {
      const base=new PIXI.BaseTexture(file),texture=new PIXI.Texture(base)
      try {await new Promise((resolve,reject)=>{if(base.valid)resolve();else{base.once('loaded',resolve);base.once('error',reject)}})}
      catch(error){texture.destroy(true);throw error}
      base.alphaMode=0
      return texture
    },
    createRuntime:(id,layers,textures)=> {
      const m=layers[0],sprite=createNativeLightQuad(PIXI,getRenderer(),textures[0],m.anchorX,m.anchorY,m.width,m.height)
      parent()?.addChild(sprite);return {sprite,id}
    },
    destroyRuntime:r=>{r.sprite.removeFromParent();r.sprite.destroy()},destroyTexture:t=>t.destroy(true),onReady,
    onError:error=>console.warn('[ChibiStage] Searchlight resource unavailable',error),
  })
  const model=(data,asset)=>data?.assets[asset]?.file?{layers:[{...data.assets[asset],asset}]}:null
  const assets=data=>data?.assets||{}
  async function prepare(data,events) {
    const used=new Set((events||[]).filter(e=>!e.hide && e.command.startsWith('Searchlight_show')).map(e=>e.values[1]))
    const results=await Promise.all([...used].map(asset=>store.prepare(model(data,asset),assets(data))))
    if(!results.every(Boolean))throw new Error('Searchlight 原始图片尚未就绪')
  }
  function update(data,states,width,height,scale,enabled) {
    for(const r of store.runtimes.values())r.sprite.visible=false
    if(!enabled)return 0
    const fit=Math.min(width/1280,height/720)*scale
    let count=0
    for(const state of states) {
      if(state.alpha<=0 || state.deferred)continue
      const runtime=store.ensure(`${state.id}:${state.asset}`,model(data,state.asset),assets(data))
      if(!runtime)continue
      const sprite=runtime.sprite
      sprite.position.set(width/2+state.x*fit,height/2+(360-state.y)*fit)
      sprite.scale.set(state.rootScale*state.scaleX*fit,state.rootScale*state.scaleY*fit)
      sprite.rotation=-state.angle*Math.PI/180;sprite.tint=state.color;sprite.alpha=state.alpha;sprite.zIndex=state.depth;sprite.visible=true
      count++
    }
    return count
  }
  return {prepare,update,release:()=>store.release()}
}
