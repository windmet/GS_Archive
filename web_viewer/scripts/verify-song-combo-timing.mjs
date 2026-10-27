import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { createSongComboPresentation, noteTimingSeconds, delayedChartSeconds, comboLayout, sampleCombo315, songComboTiming as native } from '../src/presentation/SongComboTiming.js'
assert.equal(native.timing.min,-30);assert.equal(native.timing.max,30)
assert.ok(Math.abs(noteTimingSeconds(1)-1/60)<1e-8)
assert.ok(Math.abs(delayedChartSeconds(10,6)-9.9)<1e-6,'positive delays rather than advances')
assert.ok(Math.abs(delayedChartSeconds(10,-6)-10.1)<1e-6)
assert.equal(noteTimingSeconds(60),noteTimingSeconds(30))
assert.equal(noteTimingSeconds(-60),noteTimingSeconds(-30))
const combo=createSongComboPresentation()
const state=(seconds,count,crossed=[])=>({seconds,count,crossed})
assert.equal(combo.sample(state(0,0),true).visible,false)
assert.equal(combo.sample(state(1,1,[{seconds:1,events:[{}]}])).visible,false)
assert.ok(Math.abs(combo.sample(state(2.05,2,[{seconds:2,events:[{}]}])).scale-1.2)<1e-6,'native clip apex')
assert.equal(combo.sample(state(2.2,2)).scale,1)
assert.equal(combo.sample(state(1.5,76),true).scale,1,'seek shows count without replaying a pop')
const active=combo.sample(state(3.025,77,[{seconds:3,events:[{}]}]))
assert.ok(Math.abs(active.scale-1.125)<1e-5,'Hermite tangents, not linear 1.1')
assert.deepEqual(combo.sample(state(3.025,77)),active,'pause freezes the clip')
const heldScale=combo.sample(state(3.04,77)).scale
assert.equal(combo.sample(state(3.04,78,[{seconds:3.03,events:[{}]}])).scale,heldScale,'three-frame gate prevents rapid retriggers')
const p=comboLayout(76)
assert.deepEqual(p.digits.map(d=>d.value),['7','6'])
assert.ok(p.x<1120);assert.equal(p.y,116);assert.equal(p.width,150)
for(const count of [2,76,315,999,9999]) {
 const box=comboLayout(count),peak=1.2000000476837158
 assert.ok(box.x+(box.label.x+box.label.width)*peak<=1280-16+1e-8,'reserve the entire native pop, including label')
 assert.ok(box.x+box.left+box.lineWidth<=1280-16+1e-8,'underline ends inside the SVG')
}
assert.equal(native.layout.digitImage.preserveAspect,false,'consume source Image sizing, not a guessed font aspect')
assert.equal(comboLayout(10000).digits.length,4)
assert.equal(Object.keys(native.sprites).length,12)
assert.equal(native.special315.layers.length,6)
assert.deepEqual(native.special315.layers.map(l=>l.subName),['flash','glitter','speedline2','ring','logo_315_2','logo_315'])
const timeline={events:Array.from({length:316},(_,i)=>({seconds:i===315?4.1:4}))}
const milestone=createSongComboPresentation(timeline)
assert.equal(milestone.sample(state(3.9,314),true).specialAge,null)
const burst=milestone.sample(state(4.2,316,[{seconds:4,events:[{},{}]}]))
assert.ok(Math.abs(burst.specialAge-.2)<1e-8,'paired events crossing 315 cannot skip the milestone')
assert.deepEqual(milestone.sample(state(4.2,316),true).specialAge,burst.specialAge,'seek inside milestone restores exact age')
assert.equal(milestone.sample(state(5,320)).specialAge,null,'source Show315Effect disables at one second')
const particles=sampleCombo315(.2)
assert.ok(particles.some(p=>p.subName==='logo_315')&&particles.some(p=>p.subName==='logo_315_2'))
assert.deepEqual(sampleCombo315(.2),particles,'pause and seek retain source sampling')
assert.equal(sampleCombo315(1).length,0)
assert.ok(particles.every(p=>p.quad.every(q=>q.depth===1)),'UI orthographic projection, not note-lane perspective')
assert.equal(particles.find(p=>p.subName==='logo_315').blendMode,'source-over')
assert.equal(particles.find(p=>p.subName==='logo_315_2').blendMode,'lighter')
for(const s of [...Object.values(native.sprites),...Object.values(native.special315.assets)]) {
 const url=new URL('../public'+s.url,import.meta.url)
 if(fs.existsSync(url))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(url)).digest('hex'),s.sha256)
}
console.log('Native timing, safe Combo bounds, six 315 systems/three textures, exact milestone/pause/seek, Hermite and asset hashes passed')
