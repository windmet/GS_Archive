import * as PIXI from 'pixi.js'
import {Spine,SkeletonBinary,AtlasAttachmentLoader} from '@pixi-spine/runtime-3.8'
import {TextureAtlas,MixBlend} from '@pixi-spine/base'
import {loadAndCreateSpine} from './spineSpawnPipeline.js'
import {loadImageTexture} from './loadImageTexture.js'
import {createStoryAssetTransport} from './StoryAssetTransport.js'
import {decodeSpineAtlasText} from '../../shared/story/SpineAtlasPages.js'
import {decodeUnitySpineSkeleton} from '../../shared/story/SpineBinary.js'
import {neckOverlayAnimation} from './spineNeckOverlay.js'
import {STUDIO_WIDTH,STUDIO_HEIGHT,studioExportSize,studioAnimationPlan} from './PictureStudioPolicy.mjs'

/** An owned single-actor canvas. No Player/ADV scheduler or global GPU cache. */
export class PictureStudioStage {
  constructor(container){
    this.disposed=false;this.controllers=new Map();this.overlays=new Map();this.model=null
    this.zoom=1;this.offset=0;this.playing=false
    this.transport=createStoryAssetTransport({maxBytes:12*1024*1024,maxEntries:24})
    this.app=new PIXI.Application({width:STUDIO_WIDTH,height:STUDIO_HEIGHT,resolution:1,antialias:true,backgroundColor:0xe5eef5,backgroundAlpha:1})
    this.app.view.setAttribute('aria-label','摄影画布');this.app.view.setAttribute('role','img')
    container.appendChild(this.app.view)
    this.background=new PIXI.Container();this.actors=new PIXI.Container();this.decorations=new PIXI.Container()
    this.picture=new PIXI.Container();this.picture.addChild(this.background,this.actors)
    this.app.stage.addChild(this.picture,this.decorations)
    this.app.ticker.maxFPS=30
    this.tick=()=>{
      const model=this.model
      if(!model)return
      this.updateModel(this.playing?Math.min(.05,this.app.ticker.deltaMS/1000):0)
    }
    this.app.ticker.add(this.tick)
    this.visibility=()=>document.hidden?this.app.stop():this.app.start()
    document.addEventListener('visibilitychange',this.visibility)
  }
  owner(key){
    this.controllers.get(key)?.abort()
    const controller=new AbortController();this.controllers.set(key,controller)
    return {signal:controller.signal,current:()=>!this.disposed && !controller.signal.aborted && this.controllers.get(key)===controller}
  }
  async texture(url,signal){
    // New objects per studio load. Destroying these cannot invalidate Player textures.
    return loadImageTexture(url,{signal,allowFallback:false,
      createBaseTexture:image=>new PIXI.BaseTexture(image),createTexture:base=>new PIXI.Texture(base)})
  }
  destroyModel(){
    if(!this.model)return
    this.model.spine.destroy({children:true,texture:false,baseTexture:false})
    for(const texture of this.model.textures)texture.destroy(true)
    this.model=null
  }
  cancelModel(){this.controllers.get('model')?.abort();this.destroyModel()}
  async loadModel(modelId,binding,pose,face){
    const owner=this.owner('model'),textures=new Set();this.destroyModel()
    try{
      const result=await loadAndCreateSpine({modelId,atlasUrl:binding.atlas.url,skelUrl:binding.skeleton.url,
        decodeAtlasText:decodeSpineAtlasText,decodeSkelBuffer:decodeUnitySpineSkeleton,
        Spine,SkeletonBinary,AtlasAttachmentLoader,TextureAtlas,signal:owner.signal,transport:this.transport,
        resolveTextureUrl:async(_,page)=>{
          const bound=binding.textures.find(entry=>entry.url.endsWith('/'+page))
          if(!bound?.url)throw Error('模型纹理页没有明确绑定')
          return bound.url
        },
        loadTextureFromUrl:async(url,{signal})=>{
          const texture=await this.texture(url,signal)
          if(!owner.current()){texture.destroy(true);signal.throwIfAborted()}
          textures.add(texture);return texture
        }})
      if(!owner.current()){result.spine.destroy({children:true,texture:false,baseTexture:false});throw new DOMException('Aborted','AbortError')}
      if(!result.hasMeshOrRegion){result.spine.destroy({children:true,texture:false,baseTexture:false});throw Error('模型没有可展示的图像附件')}
      const {spine}=result;spine.autoUpdate=false
      this.model={modelId,spine,textures,names:result.animNames,neckBones:[],neckSlots:[],flags:{}}
      this.actors.addChild(spine)
      this.applyPreset(pose,face)
      const bounds=spine.getLocalBounds()
      if(!(bounds.width>0 && bounds.height>0))throw Error('模型展示范围无效')
      this.model.baseScale=Math.min(STUDIO_HEIGHT*.9/bounds.height,STUDIO_WIDTH*.7/bounds.width)
      spine.pivot.set(bounds.x+bounds.width/2,bounds.y+bounds.height)
      this.compose(this.zoom,this.offset)
      return {modelId,animationCount:result.animNames.length}
    }catch(error){
      if(this.model?.textures===textures)this.destroyModel()
      else for(const texture of textures)if(!texture.destroyed)texture.destroy(true)
      throw error
    }
  }
  applyPreset(pose,face){
    const model=this.model;if(!model)throw Error('模型尚未载入')
    const {spine}=model
    try{
      const plan=studioAnimationPlan(pose,face,model.names)
      spine.state.clearTracks();spine.skeleton.setToSetupPose();spine.visible=true
      const body=spine.state.setAnimation(0,plan.motion,plan.motion.endsWith('_loop'));body.mixDuration=0
      if(!this.playing && !plan.motion.endsWith('_loop'))body.trackTime=body.animation.duration
      const expression=spine.state.setAnimation(1,plan.face,true);expression.mixDuration=0
      const command=face.commands.find(command=>command.type==='idol_face') || pose.commands.find(command=>command.type==='idol_face')
      model.flags={sweat:command?.values[4]==='汗',blush:command?.values[5]==='チーク'}
      model.neckBones=[];model.neckSlots=[]
      if(plan.neck){
        const neck=spine.state.setAnimation(3,plan.neck,false)
        neck.animation=neckOverlayAnimation(neck.animation,spine.skeleton.data);neck.mixBlend=MixBlend.add;neck.mixDuration=0;neck.trackTime=this.playing?0:neck.animation.duration
        model.neckBones=[...new Set(neck.animation.timelines.map(t=>t.boneIndex).filter(Number.isInteger))]
        model.neckSlots=[...new Set(neck.animation.timelines.map(t=>t.slotIndex).filter(Number.isInteger))]
      }
      this.updateModel(0);this.app.renderer.render(this.app.stage)
      return plan
    }catch(error){spine.visible=false;throw error}
  }
  updateModel(delta){
    const model=this.model;if(!model)return
    const {spine}=model
    // Reset additive targets before applying base and neck tracks, as in ADV.
    for(const index of model.neckBones)spine.skeleton.bones[index]?.setToSetupPose()
    for(const index of model.neckSlots)if(spine.skeleton.slots[index]?.deform)spine.skeleton.slots[index].deform.length=0
    spine.update(delta)
    for(const slot of spine.skeleton.slots){
      if(/cheek/i.test(slot.data.name) && !model.flags.blush)slot.color.a=0
      if(/^(swet|sweat)\b/i.test(slot.data.name) && !model.flags.sweat)slot.color.a=0
    }
  }
  compose(zoom=1,offset=0){
    this.zoom=Math.max(.6,Math.min(1.6,Number(zoom)||1));this.offset=Math.max(-.35,Math.min(.35,Number(offset)||0))
    const model=this.model;if(!model?.baseScale)return
    model.spine.scale.set(model.baseScale*this.zoom)
    model.spine.position.set(STUDIO_WIDTH*(.5+this.offset),STUDIO_HEIGHT*.97)
    this.app.renderer.render(this.app.stage)
  }
  setPlaying(value){
    if(value && !this.playing && this.model)for(const track of [0,3]){const current=this.model.spine.state.getCurrent(track);if(current)current.trackTime=0}
    this.playing=!!value
  }
  setWebFilter(resourceId=''){
    this.picture.filters=null;this.filter?.destroy();this.filter=null
    if(!resourceId)return
    const filter=new PIXI.ColorMatrixFilter()
    if(resourceId==='sepia' || resourceId==='sepia_light')filter.sepia()
    else if(resourceId==='gray' || resourceId==='mono')filter.desaturate()
    else throw Error('此滤镜没有网页近似实现')
    const strength=resourceId==='sepia_light'?.35:resourceId==='gray'?.6:1
    const identity=[1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0]
    filter.matrix=filter.matrix.map((value,index)=>identity[index]+(value-identity[index])*strength)
    this.filter=filter;this.picture.filters=[filter]
    this.app.renderer.render(this.app.stage)
  }
  clearOverlay(key){
    for(const {sprite,texture} of this.overlays.get(key)||[]){sprite.destroy({texture:false,baseTexture:false});texture.destroy(true)}
    this.overlays.delete(key)
  }
  async setImages(key,bindings=[]){
    const owner=this.owner(key);this.clearOverlay(key)
    const loaded=[]
    try{
      for(const binding of bindings){
        if(!binding?.url)throw Error('素材文件尚未绑定')
        const texture=await this.texture(binding.url,owner.signal)
        if(!owner.current()){texture.destroy(true);throw new DOMException('Aborted','AbortError')}
        const sprite=new PIXI.Sprite(texture);loaded.push({sprite,texture})
        if(key==='background'){
          const scale=Math.max(STUDIO_WIDTH/texture.width,STUDIO_HEIGHT/texture.height)
          sprite.anchor.set(.5);sprite.scale.set(scale);sprite.position.set(STUDIO_WIDTH/2,STUDIO_HEIGHT/2)
        }else if(key==='sticker'){
          const scale=Math.min(220/texture.width,180/texture.height)
          sprite.scale.set(scale);sprite.position.set(STUDIO_WIDTH*.08,STUDIO_HEIGHT*.72)
        }else{
          // Original frame prefab layout is unavailable. Explicit web corner layout.
          const scale=Math.min(1.5,340/texture.width,220/texture.height)
          sprite.scale.set(scale)
          if(loaded.length===1)sprite.position.set(0,0)
          else{sprite.anchor.set(1);sprite.position.set(STUDIO_WIDTH,STUDIO_HEIGHT)}
        }
      }
      if(!owner.current())throw new DOMException('Aborted','AbortError')
      this.overlays.set(key,loaded)
      const parent=key==='background'?this.background:this.decorations
      for(const {sprite} of loaded)parent.addChild(sprite)
      // Stable layering after asynchronous arrivals: stickers below frame pieces.
      for(const item of this.overlays.get('frame')||[])this.decorations.setChildIndex(item.sprite,this.decorations.children.length-1)
      this.app.renderer.render(this.app.stage)
    }catch(error){for(const {sprite,texture} of loaded){sprite.destroy({texture:false,baseTexture:false});texture.destroy(true)}throw error}
  }
  async exportPng(){
    if(this.disposed || !this.model?.spine.visible)throw Error('画布尚未准备好')
    this.updateModel(0);this.app.renderer.render(this.app.stage)
    try{
      // No display-object target: extract exactly our bounded screen framebuffer,
      // rather than expanding to off-screen actor/decoration bounds.
      const source=this.app.renderer.extract.canvas(),size=studioExportSize()
      const canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height
      const context=canvas.getContext('2d');if(!context)throw Error('浏览器没有可用的导出画布')
      context.drawImage(source,0,0,size.width,size.height)
      return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PNG 编码失败')),'image/png'))
    }
    catch(error){if(error.name==='SecurityError')throw Error('图片跨域权限不允许导出，请更换素材。');throw error}
  }
  destroy(){
    if(this.disposed)return;this.disposed=true
    for(const controller of this.controllers.values())controller.abort()
    this.transport.clear();document.removeEventListener('visibilitychange',this.visibility)
    this.destroyModel();for(const key of this.overlays.keys())this.clearOverlay(key)
    this.filter?.destroy()
    this.app.ticker.remove(this.tick);this.app.destroy(true,{children:true,texture:false,baseTexture:false})
  }
}
