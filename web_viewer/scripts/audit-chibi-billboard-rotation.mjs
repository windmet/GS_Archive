// Diagnostic only: reports mismatches; exit success is not renderer acceptance.
import fs from 'node:fs'
import {sampleObjectEmitter} from '../src/core/chibiObjectEmitters.js'
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'))
const proof=read('scripts/fixtures/chibi-billboard-rotation-native.json')
const data=read('public/data/stage-object-emitters.json')
const constant=scalar=>({mode:0,scalar,minScalar:scalar})
const corners=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]]
const cases=proof.cases.map(c=>{
  const system={...data.assets.fx_in_rote77_meter.systems[0],
    chain:[{position:{x:0,y:0},rotation:{x:0,y:0,z:0,w:1},scale:{x:1,y:1}}],
    alignment:0,shape:null,noise:null,stretch:null,velocity:null,gravity:null,
    size:constant(2),sizeY:null,sizeOverLife:null,sizeOverLifeY:null,
    rotation:constant(c.angles[2]),rotationX:c.rotation3d?constant(c.angles[0]):null,
    rotationY:c.rotation3d?constant(c.angles[1]):null,angularVelocity:null,angularX:null,angularY:null,
    speed:constant(0),looping:false,duration:2,delay:{mode:0,value:0,min:0},
    lifetime:constant(2),bursts:[{time:0,count:1}],rate:0}
  const sample=sampleObjectEmitter(system,0,0)[0]
  const actual=corners.map(([u,v])=>[sample.x+sample.a*u+sample.c*v,sample.y+sample.b*u+sample.d*v])
  const expected=c.expected.map(v=>[v.position[0]*100,-v.position[1]*100])
  const maxError=Math.max(...actual.flatMap((v,i)=>v.map((x,j)=>Math.abs(x-expected[i][j]))))
  return {rotation3d:c.rotation3d,angles:c.angles,nativeScreenAngle:c.screenRightAxisAngle,
    viewerScreenAngle:Math.atan2(sample.b,sample.a),maxCornerErrorPx:maxError,matches:maxError<.001}
})
console.log(JSON.stringify({boundary:'Synthetic identity view, same UV corner order; diagnostics only, no scene/device parity.',
  cases,matchingCases:cases.filter(c=>c.matches).length,totalCases:cases.length},null,2))
