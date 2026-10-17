import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {attachSearchlights,searchlightsAt} from '../src/core/chibiSearchlights.js'
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url)),sha=b=>crypto.createHash('sha256').update(b).digest('hex')
const data=JSON.parse(read('public/data/stage-searchlights.json'))
const published=process.argv.includes('--published-assets')
const index=published?JSON.parse(read('public/assets/live-chibi/choreography/index.json')):{songs:Object.entries(data.songs).map(([id,s])=>({id,source:s.source,songCode:s.songCode}))}
const hash=published?sha(read('public/assets/live-chibi/choreography/index.json')):data.choreographyIndexSha256
assert.equal(attachSearchlights(index,data,hash).songs.length,118)
assert.throws(()=>attachSearchlights(index,data,'0'.repeat(64)))
assert.equal(Object.values(data.songs).reduce((n,s)=>n+s.events.length,0),10583)
assert.equal(Object.keys(data.assets).length,16)
for(const a of Object.values(data.assets))assert.equal(sha(read('public'+a.file)),a.pngSha256)
assert.deepEqual(data.nativeSemantics.ovalFirstAngles,[180,-180,180,-180])
assert.deepEqual(data.nativeSemantics.ovalReturnAngles,[360,-360,0,0])
assert.deepEqual(data.prefab.material.nativeBlend,{srcBlend:5,destBlend:1,blendOp:0})
const show={time:0,command:'Searchlight_show',hide:false,values:['1','fx_in_bnckgy_pinspotlight','1','1000','#ffffff','0','0','0','0','1000','1690']}
const move=mode=>({time:0,command:'Searchlight_ovalmove',values:['1','0','100','100',String(mode),'500','1000','500','1000','500']})
for(let mode=1;mode<=6;mode++) {
  const at=t=>searchlightsAt([show,move(mode)],t)[0]
  assert.ok(Math.abs(at(0).x)<1e-12 && Math.abs(at(0).y)<1e-12)
  assert.ok(Math.abs(at(1000).x-100)<1e-10 && Math.abs(at(1000).y-100)<1e-10)
  if(mode<=4){assert.ok(Math.abs(at(2500).x)<1e-10);assert.ok(Math.abs(at(3000).x)<1e-10)}
  const half=at((1-Math.SQRT1_2)*1000),sign=mode%2?1:-1
  assert.ok(Math.abs(half.x-(50+25*sign))<1e-9)
  assert.ok(Math.abs(half.y-(50-25*sign))<1e-9)
}
const fade={time:100,command:'Searchlight_fade',values:['1','1000','0']}
assert.equal(searchlightsAt([show,fade],600)[0].alpha,.25)
// Take queues Fade 100 ms before Show; the tween must survive the activation.
const preFade={time:0,command:'Searchlight_fade',values:['2','200','600']}
const lateShow={time:100,command:'Searchlight_show',hide:false,values:['2','fx_in_bnckgy_pinspotlight','0','0','#ffffff','0','0','0','0','1000','1690']}
assert.ok(searchlightsAt([preFade,lateShow],50)[0].alpha>0)
assert.equal(searchlightsAt([preFade,lateShow],500)[0].alpha,.6)
const pulse={...show,values:show.values.map((v,i)=>i===2?'2':v)}
assert.equal(searchlightsAt([pulse],125,()=>120)[0].alpha,.5)
assert.equal(searchlightsAt([pulse],250,()=>120)[0].alpha,1)
assert.equal(searchlightsAt([pulse],0)[0].deferred,'missing_native_tempo')
for(const song of Object.values(data.songs)) {
  for(const t of [...new Set(song.events.map(e=>e.time))])for(const s of searchlightsAt(song.events,t+.01,()=>120)) {
    assert.ok(['x','y','angle','alpha','scaleX','scaleY','color'].every(k=>Number.isFinite(s[k])),`${song.source} ${s.id} ${t}`)
  }
}
// Resource refinement must not clear independently prepared common layers.
const sfc=read('src/components/ChibiStageViewer.vue').toString()
const objectSync=sfc.slice(sfc.indexOf('async function syncObjectLayers()'),sfc.indexOf('function ensureBackmonitor()'))
assert.ok(!objectSync.includes('wholeScreenRenderer.clear()'))
assert.ok(!objectSync.includes('searchlightRenderer.release()'))
console.log('Searchlights: 118 arrangements / 10583 rows / 16 native Sprites; six oval modes, separate fades, flash clock and finite corpus samples passed')
