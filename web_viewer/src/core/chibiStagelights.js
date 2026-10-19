// StageLightLiveSpriteEffectDirector: native alpha/color channels in RAW milliseconds.
const clamp = value => Math.max(0, Math.min(1, value))
const parse = value => /^#[\da-f]{6}([\da-f]{2})?$/i.test(value || '')
  ? {color:parseInt(value.slice(1,7),16),alpha:value.length===9?parseInt(value.slice(7),16)/255:1} : null
const mix = (a,b,t) => [16,8,0].reduce((out,shift)=>out |
  (Math.round(((a>>shift)&255)*(1-t)+((b>>shift)&255)*t)<<shift),0)
const outQuad = t => 1-(1-clamp(t))**2
const triangle = t => 1-Math.abs(1-((t%2+2)%2))
function rainbow(color,turn) {
  const [r,g,b]=[16,8,0].map(s=>((color>>s)&255)/255),v=Math.max(r,g,b),d=v-Math.min(r,g,b)
  const h=d===0?0:(v===r?(g-b)/d+(g<b?6:0):v===g?(b-r)/d+2:(r-g)/d+4)/6
  const phase=((h+turn)%1+1)%1*6,c=d,x=c*(1-Math.abs(phase%2-1)),m=v-c
  const values=phase<1?[c,x,0]:phase<2?[x,c,0]:phase<3?[0,c,x]:phase<4?[0,x,c]:phase<5?[x,0,c]:[c,0,x]
  return values.reduce((out,n,i)=>out | (Math.round((n+m)*255)<<(16-i*8)),0)
}
// Native IListShuffle's RNG is not recovered. Use a stable permutation for seeks;
// do not claim its per-renderer phase matches the original random stream.
function shuffledRank(state,index,count) {
  const order=Array.from({length:count},(_,i)=>i)
  let seed=(state.sourceRow || 1)>>>0
  for(let i=count-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[order[i],order[j]]=[order[j],order[i]]}
  return order.indexOf(index)
}
export function sampleStagelight(state,time,index=0,count=1,layer={}) {
  if(!state || state.previewSupported===false || time<state.time)return {color:0,alpha:0}
  const native=layer.nativeColor || {r:1,g:1,b:1,a:1}
  const initial=parse(state.color) || (state.previous?sampleStagelight(state.previous,state.time,index,count,layer):
    {color:[native.r,native.g,native.b].reduce((out,n,i)=>out|(Math.round(n*255)<<(16-i*8)),0),alpha:native.a})
  const elapsed=time-state.time,half=Math.max(0,state.period || 0)/2,interval=Math.max(0,state.interval || 0)
  const mode=state.alphaMode || 0
  if(mode===0)return initial
  const colorStart=parse(state.color) || {color:0,alpha:0}
  let color=colorStart.color
  if(state.colorMode===1) {
    const duration=state.colorPeriod || 0,t=duration>0?elapsed/duration:0,end=parse(state.gradientColor)
    color=end?mix(color,end.color,triangle(t)):rainbow(color,state.direction===0?t%1:1-t%1)
  }
  const pulse=(age,ease=false)=>{
    if(age<0 || half<=0)return 0
    return age<half?(ease?outQuad(age/half):age/half):age<half*2?(ease?1-outQuad((age-half)/half):2-age/half):0
  }
  let alpha=0
  if(mode===1){const cycle=half*2+interval;alpha=cycle>0?pulse(elapsed%cycle,true):0}
  if(mode===2)alpha=half>0?outQuad(elapsed/half):1
  if(mode===3){const cycle=Math.max(half*2,interval*count),age=elapsed-shuffledRank(state,index,count)*interval;alpha=age>=0&&cycle>0?pulse(age%cycle,true):0}
  if(mode===4){const beat=60000/state.tempo;alpha=Number.isFinite(beat)&&beat>0?1-(elapsed%beat)/beat:0}
  if(mode===5){const age=elapsed-(index%2)*interval;alpha=age>=0&&half>0?triangle(age/half):0}
  if(mode===6 || mode===7){const order=mode===6?index:count-index-1,age=elapsed-order*interval,cycle=count*interval;alpha=age>=0?pulse(cycle>0?age%cycle:age):0}
  return {color,alpha:clamp(alpha)}
}
export function stagelightStatesAt(events=[],time=0,tempo=null) {
  const states=new Map()
  for(const event of events) {
    if(event.time>time)break
    const previous=states.get(event.id)
    // EraseEffect destroys the prefab immediately; value102 is unused here.
    if(event.hide){states.delete(event.id);continue}
    states.set(event.id,{...event,asset:previous?.asset || event.asset,previous,tempo})
  }
  return states
}
export function validateStagelightData(data,hash) {
  if(data?.schemaVersion!==1 || data.choreographyIndexSha256!==hash || !/^[a-f0-9]{64}$/.test(hash || ''))throw Error('Stagelight choreography mismatch')
  let count=0
  for(const track of Object.values(data.songs || {})) {
    let previous=null
    if(!Array.isArray(track.events)||!Array.isArray(track.tempo?.values))throw Error('Invalid Stagelight track')
    for(const e of track.events){
      if(!Number.isFinite(e.time)||!Number.isInteger(e.id)||!Number.isInteger(e.sourceRow)||typeof e.hide!=='boolean'
        || !e.hide && (!e.asset || !Number.isInteger(e.alphaMode)||e.alphaMode<0||e.alphaMode>7)
        || previous && (e.time<previous.time || e.time===previous.time&&e.sourceRow<=previous.sourceRow))throw Error('Invalid Stagelight event')
      previous=e;count++
    }
  }
  if(count!==data.eventCount)throw Error('Stagelight count mismatch')
  return data
}

export function createStagelightRuntime(PIXI, parent, layers, textures) {
  const container = new PIXI.Container()
  container.sortableChildren = true
  const frameTextures = []
  const sprites = layers.map((layer, index) => {
    let texture = textures[index]
    if (layer.crop) {
      const {x,y,width,height} = layer.crop
      texture = new PIXI.Texture(texture.baseTexture,new PIXI.Rectangle(x,y,width,height))
      frameTextures.push(texture)
    }
    const sprite = new PIXI.Sprite(texture)
    sprite.anchor.set(layer.anchorX, layer.anchorY)
    sprite.position.set(layer.x, layer.y)
    sprite.scale.set(layer.scaleX, layer.scaleY)
    sprite.rotation = layer.rotation || 0
    sprite.zIndex = layer.sortingOrder || 0
    sprite.blendMode = PIXI.BLEND_MODES.ADD
    container.addChild(sprite)
    return sprite
  })
  parent.addChild(container)
  return { container, sprites, frameTextures }
}

// SetColor assigns renderer RGBA; prefab color is only the initial fallback.
export function applyNativeLampColor(lamp) { return lamp }
