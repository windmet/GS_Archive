import assert from 'node:assert/strict'
import fs from 'node:fs'
import { sampleBackmonitorLogo,logoProjectiveQuad,logoFadeAt,updateBackmonitorLogoMesh } from '../src/core/chibiBackmonitorLogo.js'
const close=(a,b)=>assert(Math.abs(a-b)<1e-9, `${a} != ${b}`)
const source=JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-backmonitor-logo-native.json',import.meta.url)))
const model={width:1200,height:800,localScale:source.transform.scale.x,perspectiveAngle:10,duration:2,
 curve:{index:0,initialValue:0,keys:[{time:0,coefficients:[0,0,180,0]},{time:2,coefficients:[0,0,0,360]}]},
 previewSongs:['tkstp1','tkstp2','drvalv'],previewMovie:'live_backmonitor_movie_trhorz_01',
 previewMovies:{drvalv:'live_backmonitor_movie_cool_01_2'},fadeControls:{drvalv:'native-fixed-500ms'}}
const state={movie:model.previewMovie,movieTime:95850,rawValue6:1,x:-7,y:340,scale:920}
const sample=t=>sampleBackmonitorLogo('tkstp1',state,t,model)
assert.equal(sample(95849),null);assert.equal(sample(95850).angle,0)
assert.equal(sample(96350).angle,90);assert.equal(sample(96850).angle,180)
assert.deepEqual(sample(111000),sample(111000),'Paused mesh is deterministic')
sample(115000);assert.equal(sample(95850).angle,0,'Backward seek recomputes phase')
for (const input of [{...state,rawValue6:0},{...state,movie:'other'},{...state,y:5000}])
 assert.equal(sampleBackmonitorLogo('tkstp1',input,111000,model),null)
assert.equal(sampleBackmonitorLogo('montns',state,111000,model),null)
const drive={...state,movie:model.previewMovies.drvalv,movieTime:15700}
assert.equal(sampleBackmonitorLogo('drvalv',drive,16200,model).angle,90)
assert.equal(sampleBackmonitorLogo('drvalv',{...drive,rawValue6:0},16200,model),null)
const fadeEvents=[{time:15700,movie:drive.movie,rawValue6:1,opacity:1000},
 {time:29600,movie:drive.movie,rawValue6:0,opacity:1000}]
assert.equal(logoFadeAt(fadeEvents,15700).alpha,0)
assert.equal(logoFadeAt(fadeEvents,16200).alpha,.8)
assert.equal(logoFadeAt(fadeEvents,29600).alpha,.8)
close(logoFadeAt(fadeEvents,29850).alpha,.2)
assert.equal(logoFadeAt(fadeEvents,30600).alpha,0)
const fading=sampleBackmonitorLogo('drvalv',{...drive,rawValue6:0,movieTime:29600},29850,model,fadeEvents)
close(fading.alpha,.2)
assert.equal(fading.angle,(29850-15700)/1000%2*180,'Fade continues the original rotation rather than resetting it')
assert.equal(sampleBackmonitorLogo('drvalv',{...drive,rawValue6:0},30600,model,fadeEvents),null)
assert.equal(logoFadeAt(fadeEvents,16200).alpha,.8,'Backward seek reconstructs alpha without residual fade state')
assert.deepEqual(logoFadeAt(fadeEvents.map(e=>({...e,opacity:0,rawValue7:0})),16000),logoFadeAt(fadeEvents,16000),'GrowSprite alpha never controls logo fade duration')
close(logoFadeAt([fadeEvents[0],{...fadeEvents[0],time:15900}],16150).alpha,.728)
const interrupted=[fadeEvents[0],{...fadeEvents[1],time:15900}]
assert.ok(Math.abs(logoFadeAt(interrupted,16150).alpha-.128)<1e-10,'A quick hide fades from the partially shown opacity')
const mock={shader:{uniforms:{}},geometry:{getBuffer:()=>({update(){}})},mesh:{position:{set(){}},scale:{set(){}}}}
updateBackmonitorLogoMesh(mock,model,fading,{x:0,y:0,scale:1})
close(mock.shader.uniforms.uLogoAlpha,.2)
const face=logoProjectiveQuad(model,0),edge=logoProjectiveQuad(model,90),back=logoProjectiveQuad(model,180)
assert.ok(Math.abs(face.vertices[2]-face.vertices[0]-420)<.001)
assert.ok(Math.abs(edge.vertices[2]-edge.vertices[0])<3e-5,'Native float32 cos(pi/2) retains a tiny signed width')
assert.ok(back.vertices[2]<back.vertices[0],'Cull-Off back face reverses texture orientation')
const tilted=logoProjectiveQuad(model,45)
assert.notEqual(tilted.uvq[2],tilted.uvq[5],'Perspective varies independently from horizontal scale')
assert.notEqual(Math.abs(tilted.vertices[1]),Math.abs(tilted.vertices[3]),'Near and far edges have different projected height')
assert.ok([...tilted.vertices,...tilted.uvq].every(Number.isFinite))
const kernel=JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-logo-kernel-native.json',import.meta.url)))
for(const c of kernel.cases) {
 const actual=logoProjectiveQuad(model,c.angle)
 for(const [i,k] of [0,1,3,2].entries()) {
  assert.ok(Math.abs(actual.vertices[i*2]-c.vertices[k*3]*100*model.localScale)<1e-4,`Native logo X ${c.angle}/${i}`)
  assert.ok(Math.abs(actual.vertices[i*2+1]+c.vertices[k*3+1]*100*model.localScale)<1e-4,`Native logo Y ${c.angle}/${i}`)
  const expected=[c.uvq[k*3],c.uvq[k*3+2]-c.uvq[k*3+1],c.uvq[k*3+2]]
  for(let j=0;j<3;j++)assert.ok(Math.abs(actual.uvq[i*3+j]-expected[j])<2e-6,`Native logo UVQ ${c.angle}/${i}/${j}`)
 }
}
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
 assert.deepEqual(index.backmonitorLogo.previewMovies,model.previewMovies)
 for(const code of ['tkstp1','tkstp2']) {
  const events=songs.find(s=>s.songCode===code).backmonitorEvents
  assert.ok(events.some(e=>e.time===95850&&e.movie===model.previewMovie&&e.rawValue6===1))
 }
 const driveSongs=songs.filter(s=>s.songCode==='drvalv')
 assert.equal(driveSongs.length,20)
 assert.ok(driveSongs.every(s=>s.backmonitorEvents.some(e=>e.time===15700&&e.movie===model.previewMovies.drvalv&&e.rawValue6===1)))
 assert.ok(driveSongs.every(s=>s.backmonitorEvents.some(e=>e.time===29600&&e.rawValue6===0&&(e.rawValue7??e.opacity)===1000)))
 assert.deepEqual(index.backmonitorLogo.fadeControls,model.fadeControls)
}
console.log('PASS native logo phase, activation guard, rewind/pause and perspective mesh instead of flat scale')
