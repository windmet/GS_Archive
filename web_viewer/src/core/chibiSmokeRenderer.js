import {loadObjectEmitters,updateObjectEmitters} from './chibiObjectEmitterRenderer.js'
import {sampleObjectEmitter} from './chibiObjectEmitters.js'
import {smokeAt} from './chibiSmoke.js'

function destroy(runtime) {
  runtime.container.removeFromParent();runtime.container.destroy({children:true})
  for(const texture of runtime.frameTextures)texture.destroy(false)
  for(const texture of runtime.textures)texture.destroy(true)
}
export function createSmokeRenderer(PIXI,loadTexture) {
  let generation=0,prepared=null,loading=null
  const runtimes=new Map()
  function clear(){generation++;prepared=null;loading=null;for(const runtime of runtimes.values())destroy(runtime);runtimes.clear()}
  async function prepare(data,track) {
    if(prepared===track&&track)return
    if(loading?.track===track&&track)return loading.promise
    clear()
    if(!data||!track)return
    const token=generation
    const promise=(async()=>{
      const variants=new Set(track.events.filter(e=>!e.hide).map(e=>e.variant))
      const results=await Promise.allSettled([...variants].map(async variant=>{
        const ids=data.groups[variant]
        if(!ids)throw Error('Unknown Smoke source group')
        const systems=ids.map(id=>data.systems.find(s=>s.source.pathId===id))
        const runtime=await loadObjectEmitters(PIXI,{systems,textures:data.textures,masks:[]},loadTexture)
        if(token!==generation){destroy(runtime);return}
        runtimes.set(variant,runtime)
      }))
      if(token!==generation)return
      const failure=results.find(r=>r.status==='rejected')
      if(failure){clear();throw failure.reason}
      prepared=track
    })()
    loading={track,promise};await promise
  }
  function update(track,time,parent,width,height,environmentScale,cameraRotation,viewHeight,enabled) {
    for(const runtime of runtimes.values())runtime.container.visible=false
    const state=smokeAt(track,time),runtime=runtimes.get(state.variant)
    if(!runtime||prepared!==track||!parent||!enabled)return {count:0,variant:state.variant,epochs:state.epochs.length}
    const fit=Math.min(width/1280,height/720)*environmentScale
    if(runtime.container.parent!==parent)parent.addChild(runtime.container)
    runtime.container.visible=true;runtime.container.position.set(width/2,height/2);runtime.container.scale.set(fit);runtime.container.zIndex=state.depth
    updateObjectEmitters(PIXI,runtime,time,0,Infinity,cameraRotation,viewHeight,null,(system,t,_start,_stop,view)=>
      state.epochs.flatMap(epoch=>sampleObjectEmitter(system,t,epoch.start,epoch.stop??Infinity,view)
        .map(sample=>({...sample,birth:sample.birth+epoch.start/1000}))).sort((a,b)=>a.birth-b.birth).slice(-system.capacity))
    return {count:runtime.nativeParticleCount,variant:state.variant,epochs:state.epochs.length}
  }
  return {prepare,update,clear}
}
