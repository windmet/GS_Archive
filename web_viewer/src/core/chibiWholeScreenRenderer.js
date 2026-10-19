import { wholeScreenAt, sampleWholeScreen } from './chibiWholeScreen.js'
import { createNativeLightQuad } from './chibiLightQuad.js'
import { configureNativeParticleTexture } from './chibiNativeParticleMask.js'

export function createWholeScreenRenderer(PIXI) {
  const textures=new Map(),layers=new Map()
  let generation=0,prepared=null,loading=null
  function clear() {
    generation++;prepared=null;loading=null
    for(const layer of layers.values())layer.destroy({children:true})
    layers.clear()
    for(const texture of textures.values())texture.destroy(true)
    textures.clear()
  }
  async function prepare(data,events) {
    if(prepared===events)return
    if(loading?.events===events)return loading.promise
    clear();const token=generation
    const job=(async()=> {
      const ids=new Set((events||[]).flatMap(e=>(data.models[e.type]?.systems||[]).map(s=>s.texture)))
      await Promise.all([...ids].map(async id=> {
        // Own each base texture: native NPM/sampling must not mutate Pixi's cache.
        const model=data.textures[id],base=new PIXI.BaseTexture(model.file)
        const texture=new PIXI.Texture(base)
        await new Promise((resolve,reject)=> {
          if(base.valid)resolve()
          else {base.once('loaded',resolve);base.once('error',reject)}
        }).catch(error=>{texture.destroy(true);throw error})
        if(token!==generation){texture.destroy(true);return}
        configureNativeParticleTexture(texture,model.nativeSampling);textures.set(id,texture)
      }))
      if(token===generation)prepared=events
    })()
    loading={events,promise:job};await job
  }
  function update(data,events,time,parent,width,height,scale=1,enabled=true) {
    const states=wholeScreenAt(events,time,data?.models),fit=Math.min(width/1280,height/720)*scale
    let count=0
    for(const layer of layers.values())layer.visible=false
    if(!enabled || prepared!==events || !parent)return {count,types:[]}
    for(const [type,state] of states) {
      if(!state.active)continue
      const model=data.models[type];let layer=layers.get(type)
      if(!layer) {
        layer=new PIXI.Container();layer.pool=[];parent.addChild(layer);layers.set(type,layer)
        if(model.kind==='sprite') {
          const color=model.color.r?0xffffff:0
          layer.addChild(new PIXI.Graphics().beginFill(color).drawRect(-model.width/2,-model.height/2,model.width,model.height).endFill())
        }
      }
      layer.visible=true;layer.position.set(width/2,height/2);layer.scale.set(fit);layer.zIndex=state.depth;layer.alpha=state.alpha
      if(model.kind==='sprite')continue
      let cursor=0
      for(const system of model.systems)for(const p of sampleWholeScreen(system,time,state.epochs)) {
        let mesh=layer.pool[cursor]
        if(!mesh){mesh=createNativeLightQuad(PIXI,textures.get(system.texture),.5,.5,1,1);layer.addChild(mesh);layer.pool.push(mesh)}
        mesh.visible=true;mesh.position.set(p.x,p.y);mesh.scale.set(p.size);mesh.rotation=p.rotation-parent.rotation
        mesh.tint=p.color;mesh.alpha=p.alpha
        const cols=system.uv?.columns||1,rows=system.uv?.rows||1,x=p.frame%cols/cols,y=Math.floor(p.frame/cols)/rows
        mesh.uvBuffer.data.set([x,y,x+1/cols,y,x+1/cols,y+1/rows,x,y+1/rows]);mesh.uvBuffer.update()
        cursor++;count++
      }
      for(let i=cursor;i<layer.pool.length;i++)layer.pool[i].visible=false
    }
    return {count,types:[...states.values()].filter(s=>s.active).map(s=>s.type)}
  }
  return {prepare,update,clear}
}
