// Native fixture diagnostics only; matching spatial math does not admit an asset.
import fs from 'node:fs'
import {samplePlanarStretch,transformStretchVelocity,reciprocalSqrtEstimate} from '../src/core/chibiParticleStretch.js'
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'))
const proof=read('scripts/fixtures/chibi-cone-stretch-native.json'),f=Math.fround
let planarMatches=0,spatialMatches=0,maxPlanarError=0,maxSpatialError=0
const byAsset={}
for(const row of proof.cases){
  const c=row.input,[a,b,k,d,tx,ty]=c.matrix.map(f),[px,py,pz]=c.position,[sz,tz]=c.depthMatrix
  const p={x:f(f(a*px)+f(k*py)+tx),y:f(f(b*px)+f(d*py)+ty),z:f(f(sz*pz)+tz)}
  const v=transformStretchVelocity({a,b,c:k,d},{x:c.velocity[0],y:c.velocity[1]},c.cameraRotation)
  const planar=samplePlanarStretch({position:p,velocity:v,size:c.size,scaleX:c.particleScale[0],scaleY:c.particleScale[1],
    lengthScale:c.lengthScale,velocityScale:c.velocityScale,maxSize:c.maxParticleSize,cameraRotation:c.cameraRotation})
  // Same spatial reference already checked against the 16 earlier native XYZ
  // cases. Native camera position in this controlled context is (0,0,10).
  const vz=f(sz*c.velocity[2]),speed2=f(v.speedSquared+f(vz*vz))
  const factor=f(f(c.velocityScale)+f(f(f(c.lengthScale*c.particleScale[0])*c.size)*f(reciprocalSqrtEstimate(speed2)*f(1.0019569))))
  const crossX=p.y*vz-(p.z-10)*v.y,crossY=(p.z-10)*v.x-p.x*vz,norm=Math.hypot(crossX,crossY)
  const side={x:crossX/norm*c.size/2*c.particleScale[0],y:crossY/norm*c.size/2*c.particleScale[1],z:0}
  const tail={x:f(p.x-f(v.x*factor)),y:f(p.y-f(v.y*factor)),z:f(p.z-f(vz*factor))}
  const spatial=[p,tail,tail,p].map((q,i)=>['x','y','z'].map(axis=>q[axis]+side[axis]*(i<2?1:-1)))
  const planarError=Math.max(...planar.flatMap((q,i)=>['x','y'].map((axis,j)=>Math.abs(q[axis]-row.expected[i].position[j]))))
  const spatialError=Math.max(...spatial.flatMap((q,i)=>q.map((x,j)=>Math.abs(x-row.expected[i].position[j]))))
  if(planarError<2e-5)planarMatches++
  if(spatialError<2e-5)spatialMatches++
  maxPlanarError=Math.max(maxPlanarError,planarError);maxSpatialError=Math.max(maxSpatialError,spatialError)
  const result=byAsset[row.asset]??={cases:0,maxPlanarError:0,maxSpatialError:0}
  result.cases++;result.maxPlanarError=Math.max(result.maxPlanarError,planarError);result.maxSpatialError=Math.max(result.maxSpatialError,spatialError)
}
console.log(JSON.stringify({boundary:proof.boundary,totalCases:proof.cases.length,sourceSystems:Object.keys(proof.models).length,
  planarMatches,spatialMatches,maxPlanarError,maxSpatialError,byAsset},null,2))
