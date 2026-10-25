import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { createSongComboPresentation, noteTimingSeconds, delayedChartSeconds, comboLayout, songComboTiming as native } from '../src/presentation/SongComboTiming.js'
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
assert.equal(p.x,1120);assert.equal(p.y,116);assert.equal(p.width,150)
assert.equal(native.layout.digitImage.preserveAspect,false,'consume source Image sizing, not a guessed font aspect')
assert.equal(comboLayout(10000).digits.length,4)
assert.equal(Object.keys(native.sprites).length,12)
for(const s of Object.values(native.sprites)) {
 const url=new URL('../public'+s.url,import.meta.url)
 if(fs.existsSync(url))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(url)).digest('hex'),s.sha256)
}
console.log('Native +/-30 timing, 60Hz unit/sign, combo visibility/layout/digits/Hermite/gate, pause/seek and 12 sprite hashes passed')
