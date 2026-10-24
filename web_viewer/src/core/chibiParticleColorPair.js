export const COLOR_PAIR_PROFILE='native-two-gradient-bytes-v1'
const fp=Math.fround
// Unity's cached gradient interpolates packed bytes with an 8-bit weight.
// Keep the native rounding and division boundaries through both lerps.
const lerp=(a,b,w)=>(a+((128+w*(b-a))>>8))&255
function gradient(cache,t) {
  const keys=cache.keys
  const index=keys.findIndex((k,i)=>i>0&&t<k.time)
  if(index<0)return keys.at(-1).rgba
  const previous=keys[index-1],next=keys[index]
  const difference=Math.max(0,Math.min(1,fp(t-previous.time)))
  const weight=Math.trunc(fp(fp(difference*cache.inverseSpans[index])*255))
  return previous.rgba.map((v,i)=>lerp(v,next.rgba[i],weight))
}
export function samplePackedColorPair(pair,phase,randomValue,start=[255,255,255,255]) {
  if(pair.profile!==COLOR_PAIR_PROFILE)throw Error('Unbound two-gradient source')
  const t=Math.max(0,fp(fp(phase*100)*fp(.01)))
  const minimum=gradient(pair.cache.min,t),maximum=gradient(pair.cache.max,t)
  const weight=Math.trunc(fp(fp(randomValue)*255))
  return minimum.map((v,i)=>{
    const mixed=lerp(v,maximum[i],weight),product=start[i]*mixed+128
    return ((product+(product>>8))>>8)&255
  })
}
