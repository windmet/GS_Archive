import fs from 'node:fs'
import {sampleSpatialStretch,transformSpatialStretchVelocity,samplePlanarStretch,transformStretchVelocity} from '../src/core/chibiParticleStretch.js'
const proof=JSON.parse(fs.readFileSync(new URL('fixtures/chibi-source-stretch-native.json',import.meta.url),'utf8')),f=Math.fround
let matches=0,maxError=0,planarMatches=0,maxPlanarError=0
const byAsset={}
for(const row of proof.cases){
  const frame=proof.frames[row.frameIndex],c=frame.input,[a,b,k,d,tx,ty]=c.matrix.map(f),[sz,tz]=c.depthMatrix
  const position={x:f(f(a*row.position[0])+f(k*row.position[1])+tx),y:f(f(b*row.position[0])+f(d*row.position[1])+ty),z:f(f(sz*row.position[2])+tz)}
  const velocity=transformSpatialStretchVelocity({a,b,c:k,d},{x:row.velocity[0],y:row.velocity[1],z:row.velocity[2]},c.cameraMatrix,sz)
  const actual=sampleSpatialStretch({...c,position,velocity,scaleX:c.particleScale[0],scaleY:c.particleScale[1],maxSize:c.maxParticleSize})
  const planar=samplePlanarStretch({...c,position,
    velocity:transformStretchVelocity({a,b,c:k,d},{x:row.velocity[0],y:row.velocity[1]},Math.atan2(c.cameraMatrix[1],c.cameraMatrix[0])),
    scaleX:c.particleScale[0],scaleY:c.particleScale[1],maxSize:c.maxParticleSize})
  const planarError=Math.max(...planar.flatMap((v,i)=>['x','y'].map((axis,j)=>Math.abs(v[axis]-row.expected[i].position[j]))))
  maxPlanarError=Math.max(maxPlanarError,planarError);if(planarError<2e-5)planarMatches++
  const error=Math.max(...actual.flatMap((v,i)=>['x','y','z'].map((axis,j)=>Math.abs(v[axis]-row.expected[i].position[j]))))
  maxError=Math.max(maxError,error);if(error<2e-5)matches++
  const result=byAsset[frame.asset]??={cases:0,maxError:0}
  result.cases++;result.maxError=Math.max(result.maxError,error)
}
console.log(JSON.stringify({boundary:proof.boundary,sourceFrames:proof.frames.length,totalCases:proof.cases.length,matches,maxError,planarMatches,maxPlanarError,byAsset},null,2))
