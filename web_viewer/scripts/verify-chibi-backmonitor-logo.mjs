import assert from 'node:assert/strict'
import fs from 'node:fs'
import { sampleBackmonitorLogo,logoProjectiveQuad } from '../src/core/chibiBackmonitorLogo.js'
const source=JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-backmonitor-logo-native.json',import.meta.url)))
const model={width:1200,height:800,localScale:source.transform.scale.x,perspectiveAngle:10,duration:2,
 curve:{index:0,initialValue:0,keys:[{time:0,coefficients:[0,0,180,0]},{time:2,coefficients:[0,0,0,360]}]},
 previewSongs:['tkstp1','tkstp2'],previewMovie:'live_backmonitor_movie_trhorz_01'}
const state={movie:model.previewMovie,movieTime:95850,rawValue6:1,x:-7,y:340,scale:920}
const sample=t=>sampleBackmonitorLogo('tkstp1',state,t,model)
assert.equal(sample(95849),null);assert.equal(sample(95850).angle,0)
assert.equal(sample(96350).angle,90);assert.equal(sample(96850).angle,180)
assert.deepEqual(sample(111000),sample(111000),'Paused mesh is deterministic')
sample(115000);assert.equal(sample(95850).angle,0,'Backward seek recomputes phase')
for (const input of [{...state,rawValue6:0},{...state,movie:'other'},{...state,y:5000}])
 assert.equal(sampleBackmonitorLogo('tkstp1',input,111000,model),null)
assert.equal(sampleBackmonitorLogo('montns',state,111000,model),null)
const face=logoProjectiveQuad(model,0),edge=logoProjectiveQuad(model,90),back=logoProjectiveQuad(model,180)
assert.ok(Math.abs(face.vertices[2]-face.vertices[0]-420)<.001)
assert.ok(Math.abs(edge.vertices[2]-edge.vertices[0])<1e-5)
assert.ok(back.vertices[2]<back.vertices[0],'Cull-Off back face reverses texture orientation')
const tilted=logoProjectiveQuad(model,45)
assert.notEqual(tilted.uvq[2],tilted.uvq[5],'Perspective varies independently from horizontal scale')
assert.notEqual(Math.abs(tilted.vertices[1]),Math.abs(tilted.vertices[3]),'Near and far edges have different projected height')
assert.ok([...tilted.vertices,...tilted.uvq].every(Number.isFinite))
// Reconstruct UV at the fixed screen origin using barycentric interpolation
// and the shader's homogeneous division, independently of bounding-box centre.
for (let angle=0;angle<360;angle+=15) {
 if (angle===90||angle===270) continue // Edge-on triangles are degenerate.
 const {vertices:p,uvq:q}=logoProjectiveQuad(model,angle)
 const [ax,ay,bx,by,cx,cy]=p
 const denominator=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy)
 const a=((by-cy)*-cx+(cx-bx)*-cy)/denominator
 const b=((cy-ay)*-cx+(ax-cx)*-cy)/denominator
 const c=1-a-b
 const denominatorQ=a*q[2]+b*q[5]+c*q[8]
 for(const component of [0,1]) {
  const uv=(a*q[component]+b*q[3+component]+c*q[6+component])/denominatorQ
  assert.ok(Math.abs(uv-.5)<1e-6,`Texture pivot drifts at ${angle} degrees`)
 }
}
if(process.argv.includes('--published-assets')) {
 const index=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/stage-effects/index.json',import.meta.url)))
 assert.deepEqual(index.backmonitorLogo.curve,model.curve)
 assert.equal(index.assets.live_backmonitor_movie_logo_m.source.pathId,'463')
 const songs=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/choreography/index.json',import.meta.url))).songs
 for(const code of model.previewSongs) {
  const events=songs.find(s=>s.songCode===code).backmonitorEvents
  assert.ok(events.some(e=>e.time===95850&&e.movie===model.previewMovie&&e.rawValue6===1))
 }
}
console.log('PASS native logo phase, activation guard, rewind/pause and perspective mesh instead of flat scale')
