// Unity High-quality, single-octave curl kernel, libunity 0x8406ec / 0x85444c.
// Native derivative vectors use this table (hash 13/14 differ from the common
// compact Ken Perlin grad() implementation). PERM below comes from native .rodata.
const GRAD=[1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1,1,1,0,-1,1,0,0,-1,1,0,-1,-1]
const fade=t=>t*t*t*(t*(t*6-15)+10)
const derivative=t=>30*t*t*(t-1)*(t-1)
// The native helper returns dN/dx and dN/dy, including the frequency chain rule.
export function sampleNoiseDerivatives(point,frequency) {
  const f=Math.max(.000001,frequency),p=[point.x*f,point.y*f,point.z*f]
  const base=p.map(Math.floor),t=p.map((v,i)=>v-base[i]),u=t.map(fade),du=t.map(derivative)
  let dx=0,dy=0
  for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++) {
    const hash=PERM[(PERM[(PERM[(base[0]+x)&255]+base[1]+y)&255]+base[2]+z)&255]&15
    const gx=GRAD[hash*3],gy=GRAD[hash*3+1],gz=GRAD[hash*3+2]
    const dot=gx*(t[0]-x)+gy*(t[1]-y)+gz*(t[2]-z)
    const wx=x?u[0]:1-u[0],wy=y?u[1]:1-u[1],wz=z?u[2]:1-u[2]
    dx+=(gx*wx+dot*(x?1:-1)*du[0])*wy*wz
    dy+=(gy*wy+dot*(y?1:-1)*du[1])*wx*wz
  }
  return {x:dx*f,y:dy*f}
}
export function sampleCurlNoise(n,p,scroll,offset) {
  if(n.quality!==2 || n.octaveCount!==1 || n.remapEnabled || n.separateAxes)throw Error('Unsupported native curl profile')
  const f=Math.max(.000001,n.frequency)
  const x=p.x+offset.x*100,y=p.y+offset.y*100,z=p.z+offset.z*100
  const a=sampleNoiseDerivatives({x:z,y,z:x+scroll},f)
  const b=sampleNoiseDerivatives({x:x+100,y:z,z:y+scroll},f)
  const c=sampleNoiseDerivatives({x:y,y:x+100,z:z+scroll},f)
  const scale=n.strength*(n.damping?1/f:1)
  return {x:(c.x-b.y)*scale,y:(a.x-c.y)*scale,z:(b.x-a.y)*scale}
}
// Native update order: gravity/base velocity -> animated velocity + Noise ->
// ClampVelocity on the combined vector -> position += combined velocity * dt.
// The clamp writes back base velocity minus the unchanged animated component.
export function stepNoiseMotion(state,n,{dt,phase,offset,velocity,gravity,limit}) {
  const noise=sampleCurlNoise(n,state.position,phase*n.scroll,offset)
  const animated={x:velocity.x+noise.x,y:velocity.y+noise.y,z:velocity.z+noise.z}
  const base={x:state.velocity.x+gravity.x*dt,y:state.velocity.y+gravity.y*dt,z:state.velocity.z+gravity.z*dt}
  const total={x:base.x+animated.x,y:base.y+animated.y,z:base.z+animated.z}
  const length=Math.hypot(total.x,total.y,total.z)
  if(limit && length>limit.speed && limit.dampen>0) {
    const scale=1+(limit.speed/length-1)*(1-Math.pow(1-limit.dampen,Math.abs(dt)*30))
    for(const k of ['x','y','z']){total[k]*=scale;base[k]=total[k]-animated[k]}
  }
  return {position:{x:state.position.x+total.x*dt,y:state.position.y+total.y*dt,z:state.position.z+total.z*dt},velocity:base}
}

const PERM=new Uint8Array([151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180,151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180])
