import binding from '../data/chibiObjectSpatialBinding.json' with {type:'json'}
import {sampleSpatialStretch,transformSpatialStretchVelocity} from './chibiParticleStretch.js'
export const OBJECT_SPATIAL_PROFILE='native-source-spatial-v1'
export const OBJECT_SPATIAL_BINDING=binding
const f=Math.fround
export function objectSpatialContext(camera,placement,arrangementId='') {
  if(!camera?.verified || camera.focusSlot || !(camera.orthoSize>0) || !(placement.scale>0))
    throw Error('Spatial emitter requires a verified free camera and positive placement')
  const angle=camera.rotation*Math.PI/180,z=f(Math.sin(angle/2)),w=f(Math.cos(angle/2))
  const co=1-2*z*z,si=2*z*w
  const pixel=f(binding.stageScaleXY/binding.scriptDivisor),x=f(camera.x*pixel),y=f((camera.y-binding.basePos[1])*pixel)
  return {profile:OBJECT_SPATIAL_PROFILE,sourceContextSha256:binding.sourceContextSha256,arrangementId,
    cameraMatrix:[co,-si,0,0,si,co,0,0,0,0,-1,0,-co*x-si*y,si*x-co*y,binding.cameraParentZ,1],
    viewHeight:2*camera.orthoSize,outer:Number(placement.scale)/1000,
    xyScale:binding.stageScaleXY,
    offset:{x:placement.x*binding.pixelToStage,y:(placement.y-binding.basePos[1])*binding.pixelToStage},baseZ:binding.containerZ}
}
export function emitterDepthMatrix(chain) {
  let scale=1,offset=0
  for(const t of chain){
    const q=t.rotation
    if(Math.max(Math.abs(2*(q.x*q.z-q.w*q.y)),Math.abs(2*(q.y*q.z+q.w*q.x)))>1e-5)throw Error('Nonplanar spatial emitter parent')
    const z=(1-2*(q.x*q.x+q.y*q.y))*t.scale.z
    scale=z*scale;offset=z*offset+t.position.z
  }
  return {scale,offset}
}
export function spatialEmitterQuads(system,matrix,renderBasis,position,velocity,size,context) {
  const scope=system.stretch.binding
  if(context?.profile!==OBJECT_SPATIAL_PROFILE || context.sourceContextSha256!==scope?.sourceContextSha256 || !scope.arrangements.includes(context.arrangementId))
    throw Error('Unbound spatial emitter scene')
  const outer=context.outer,k=context.xyScale*outer,z=emitterDepthMatrix(system.chain)
  const m={a:f(matrix.a*k),b:f(matrix.b*k),c:f(matrix.c*k),d:f(matrix.d*k),
    tx:f((matrix.tx*outer+context.offset.x)*context.xyScale),ty:f((matrix.ty*outer+context.offset.y)*context.xyScale)}
  const sz=f(z.scale*outer),tz=f(z.offset*outer+context.baseZ)
  const world={x:f(f(m.a*position.x)+f(m.c*position.y)+m.tx),y:f(f(m.b*position.x)+f(m.d*position.y)+m.ty),z:f(f(sz*position.z)+tz)}
  const v=transformSpatialStretchVelocity(m,velocity,context.cameraMatrix,sz)
  const quad=sampleSpatialStretch({position:world,velocity:v,size,scaleX:renderBasis.scaleX*k,scaleY:renderBasis.scaleY*k,
    ...system.stretch,cameraMatrix:context.cameraMatrix,viewHeight:context.viewHeight})
  return quad.map(p=>({x:(p.x/context.xyScale-context.offset.x)/outer,y:(p.y/context.xyScale-context.offset.y)/outer}))
}
