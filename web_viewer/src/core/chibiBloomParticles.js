import { sampleParticleCurve } from './chibiParticleTimeline.js'
const range=(curve,r)=>curve.mode===3?curve.minScalar+(curve.scalar-curve.minScalar)*r:sampleParticleCurve(curve,r)
function gradient(keys,t,key){
 if(t<=keys[0].time)return keys[0][key]
 if(t>=keys.at(-1).time)return keys.at(-1)[key]
 const b=keys.findIndex(k=>k.time>t),a=keys[b-1],z=keys[b],p=(t-a.time)/(z.time-a.time)
 return a[key]*(1-p)+z[key]*p
}
// Mix particle identity and parameter channel independently, then avalanche.
// A single multiply of sequential seeds produces a rotating, evenly spaced
// birth pattern and correlates angle with lifetime/velocity.
function random(seed,birth,channel){
 let x=seed ^ Math.imul(birth+1,0x9e3779b1) ^ Math.imul(channel+1,0x85ebca77)
 x=Math.imul(x^(x>>>16),0x7feb352d)
 x=Math.imul(x^(x>>>15),0x846ca68b)
 return ((x^(x>>>16))>>>0)/4294967296
}
// Unity LimitVelocityOverLifetime uses a simulation step. The retained native
// dampen/limit curves are sampled at 60 Hz here; device frame/RNG parity is open.
function distance(system,age,life,speed){
 let t=0,d=0,v=speed
 while(t<age){const dt=Math.min(1/60,age-t),limit=sampleParticleCurve(system.speedLimit,t/life)
  if(v>limit)v+=(limit-v)*system.dampen*dt*60
  d+=v*dt;t+=dt
 }
 return d
}
export function sampleBloomSystem(system,milliseconds,activatedAt,stoppedAt=Infinity){
 const elapsed=(milliseconds-activatedAt)/1000-system.delay
 if(elapsed<0)return []
 const births=system.bursts.flatMap(b=>Array.from({length:b.count},()=>b.time))
 for(let i=0;i<Math.min(system.capacity,Math.ceil(system.duration*system.rate));i++)births.push((i+1)/system.rate)
 const seed=[...system.source.pathId].reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0)|0,7),out=[]
 for(const [i,birth] of births.entries()){
  const rnd=n=>random(seed,i,n),age=elapsed-birth,life=range(system.lifetime,rnd(0))
  if(age<0||age>=life || activatedAt+(birth+system.delay)*1000>stoppedAt)continue
  const fraction=age/life,theta=rnd(1)*Math.PI*2,radius=Math.sqrt(rnd(2))*system.radius+distance(system,age,life,range(system.speed,rnd(3)))
  const x=Math.cos(theta)*radius,y=Math.sin(theta)*radius*Math.cos(system.angle*Math.PI/180)*system.scaleY
  const cp=system.colorMode===4?rnd(4):0,keys=system.color.colors,over=system.colorOverLife
  const color=['r','g','b'].reduce((value,k,j)=>value|(Math.round(gradient(keys,cp,k)*gradient(over.colors,fraction,k)*255)<<(16-j*8)),0)
  out.push({x:(system.position.x+x)*100,y:-(system.position.y+y)*100,
   size:range(system.size,rnd(5))*sampleParticleCurve(system.sizeOverLife,fraction)*100,
   alpha:gradient(system.color.alphas,cp,'value')*gradient(over.alphas,fraction,'value'),color,
   rotation:-range(system.rotation,rnd(6)),birth})
 }
 return out.slice(-system.capacity)
}
export function attachBloom(index,data,hash){
 if(data?.schemaVersion!==1||data.objectIndexSha256!==hash||!data.texture?.pngSha256)throw Error('Bloom object/resource identity mismatch')
 const assets={...index.assets}
 for(const [name,model] of Object.entries(data.assets)){
  const original=assets[name]
  if(original?.bundle!==model.bundle || original.particleCount!==model.systems.length || model.profile!=='unmasked-circle-bloom-partial-v1')throw Error('Bloom prefab mismatch')
  assets[name]={...original,bloomAnimation:{...model,texture:data.texture}}
 }
 return {...index,assets}
}
export async function loadChibiBloom(PIXI,model,loadTexture){
 const texture=await loadTexture(model.texture.file),container=new PIXI.Container(),frameTextures=[]
 try{
  const bloomEmitters=model.systems.map(system=>{
   const frame=new PIXI.Texture(texture.baseTexture,new PIXI.Rectangle(system.frame%4*256,Math.floor(system.frame/4)*256,256,256));frameTextures.push(frame)
   const sprites=Array.from({length:system.capacity},()=>{const sprite=new PIXI.Sprite(frame);sprite.anchor.set(.5);sprite.zIndex=system.sortingOrder;sprite.blendMode=PIXI.BLEND_MODES.ADD;sprite.visible=false;container.addChild(sprite);return sprite})
   return {system,sprites}
  })
  return {container,textures:[texture],frameTextures,bloomEmitters,destroyed:false}
 }catch(error){container.destroy({children:true});for(const t of frameTextures)t.destroy(false);texture.destroy(true);throw error}
}
export function updateChibiBloom(runtime,time,activatedAt,stoppedAt=Infinity){
 let count=0
 for(const {system,sprites} of runtime.bloomEmitters){
  const samples=sampleBloomSystem(system,time,activatedAt,stoppedAt);count+=samples.length
  for(const [i,sprite] of sprites.entries()){
   const sample=samples[i];sprite.visible=Boolean(sample&&sample.alpha>.001)
   if(!sample)continue
   sprite.position.set(sample.x,sample.y);sprite.width=sample.size;sprite.height=sample.size*system.billboardScaleY;sprite.rotation=sample.rotation;sprite.alpha=sample.alpha;sprite.tint=sample.color
  }
 }
 runtime.bloomParticleCount=count
}
