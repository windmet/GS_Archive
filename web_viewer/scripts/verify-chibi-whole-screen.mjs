import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {attachWholeScreen,wholeScreenAt,sampleWholeScreen} from '../src/core/chibiWholeScreen.js'
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url))
const data=JSON.parse(read('public/data/stage-whole-screen.json'))
const sha=b=>crypto.createHash('sha256').update(b).digest('hex')
const published=process.argv.includes('--published-assets')
const index=published?JSON.parse(read('public/assets/live-chibi/choreography/index.json')):{songs:Object.entries(data.songs).map(([id,s])=>({id,songCode:s.songCode,source:s.source}))}
const hash=published?sha(read('public/assets/live-chibi/choreography/index.json')):data.choreographyIndexSha256
const attached=attachWholeScreen(index,data,hash)
assert.equal(attached.songs.length,118)
assert.equal(attached.songs.reduce((n,s)=>n+s.wholeScreenEvents.length,0),461)
assert.throws(()=>attachWholeScreen(index,data,'0'.repeat(64)))
for(const texture of Object.values(data.textures))assert.equal(sha(read('public'+texture.file)),texture.pngSha256)
assert.equal(data.models[6].kind,'unsupported')
assert.equal(Object.values(data.songs).flatMap(s=>s.events).filter(e=>e.unresolvedReason).length,1)
const events=[{time:0,type:3,hide:false,depth:2100},{time:1000,type:3,hide:true,duration:2000},{time:1500,type:3,hide:false,depth:2200}]
let s=wholeScreenAt(events,1200,data.models).get(3)
assert.equal(s.active,true);assert.equal(s.playing,false);assert.equal(s.epochs[0].stop,1000)
assert.ok(sampleWholeScreen(data.models[3].systems[0],1200,s.epochs).length>0,'StopEmitting retains living particles')
assert.equal(wholeScreenAt(events,2999,data.models).get(3).active,true)
assert.equal(wholeScreenAt(events,3000,data.models).get(3).active,false,'Play does not cancel native deactivate callback')
const sprite=[{time:0,type:1,hide:false,depth:2100,duration:1000},{time:1000,type:1,hide:true,duration:1000}]
assert.equal(wholeScreenAt(sprite,500,data.models).get(1).alpha,.75)
assert.equal(wholeScreenAt(sprite,1500,data.models).get(1).alpha,.25)
assert.equal(wholeScreenAt(sprite,2000,data.models).get(1).active,false)
const flash=attached.songs.find(s=>s.id==='flslgt_live_effect')
for(const time of [0,1000,10000,35500,60000,100000]) {
  for(const state of wholeScreenAt(flash.wholeScreenEvents,time,data.models).values()) {
    if(!state.active)continue
    for(const system of data.models[state.type].systems||[]) {
      const particles=sampleWholeScreen(system,time,state.epochs)
      assert.ok(particles.length<=system.capacity)
      assert.deepEqual(particles,sampleWholeScreen(system,time,state.epochs))
      for(const p of particles){assert.ok(Object.values(p).every(Number.isFinite));assert.ok(p.frame>=0 && p.frame<(system.uv?system.uv.columns*system.uv.rows:1))}
    }
  }
}
// Closed geometric oracle: identity box with constant velocity projected to XY.
const source=data.models[4].systems[0],probe={...source,shape:{m_Scale:{x:0,y:0,z:0}},chain:[{position:{x:2,y:3,z:0},scale:{x:1,y:1,z:1},rotation:{x:0,y:0,z:0,w:1}}],rate:1,lifetime:{mode:0,scalar:4},speed:{mode:0,scalar:0},size:{mode:0,scalar:2},sizeOverLife:null}
const point=sampleWholeScreen(probe,1500,[{start:0,stop:Infinity}])[0]
assert.equal(point.x,200);assert.equal(point.y,-300);assert.equal(point.size,200)
console.log('Whole_screen: 118 source identities, 461 rows, native textures, stop tails, callback ordering, sprite fades, deterministic particles passed')
