import assert from 'node:assert/strict'
import fs from 'node:fs'
import {objectParticlePresentation,lastParticleLoop} from '../src/core/chibiObjectParticleLifecycle.js'
import {sampleBloomSystem} from '../src/core/chibiBloomParticles.js'
import {sampleFloorSystem} from '../src/core/chibiFloorParticles.js'
const state={alpha:0,activatedAt:1800,particleStopAt:null,particleRetireAt:null}
assert.deepEqual(objectParticlePresentation(state,1800),{alpha:1,visible:true,stoppedAt:Infinity})
const stopped={...state,alpha:.5,particleStopAt:2400,particleRetireAt:3400}
assert.deepEqual(objectParticlePresentation(stopped,3000),{alpha:1,visible:true,stoppedAt:2400})
assert.equal(objectParticlePresentation(stopped,3400).visible,false)
assert.equal(lastParticleLoop(2.3,1.5,1),1)
assert.equal(lastParticleLoop(.1,-.1,1),null)
const data=JSON.parse(fs.readFileSync(new URL('../public/data/stage-bloom-particles.json',import.meta.url)))
const s=data.assets.fx_in_flslgt_bloom_1.systems[0]
const now=sampleBloomSystem(s,800,0,300),later=sampleBloomSystem(s,900,0,300)
assert.ok(now.length>0)
assert.ok(now.every(p=>p.birth+s.delay<=.3))
assert.ok(later.every(p=>p.birth+s.delay<=.3))
const floor={source:{pathId:'1'},rate:10,prewarmSeconds:0,lifetime:{mode:0,scalar:1,minScalar:1},size:{mode:0,scalar:1},rotation:{mode:0,scalar:0},color:{colors:[{time:0,r:1,g:1,b:1}],alphas:[{time:0,value:1}]},alpha:[{time:0,value:1}],shape:{x:1,y:1},position:{x:0,y:0},capacity:100}
assert.ok(sampleFloorSystem(floor,500,0,200).every(p=>p.birth<=2))
assert.deepEqual(sampleFloorSystem(floor,1300,0,200),[])
const source=fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
const block=source.slice(source.indexOf('function sampleObjectLayerAlpha('),source.indexOf('async function loadObjectLayerRuntime('))
const selectedSong={value:{objectLayerEvents:[{time:1800,asset:'bloom',duration:1200,x:0,y:360,scale:1000,depth:1599,hide:false},{time:2400,asset:'bloom',duration:1000,hide:true}]}}
const statesAt=new Function('selectedSong',block+';return objectLayerStatesAt')(selectedSong)
const shown=statesAt(1800).get('bloom')
assert.equal(shown.alpha,0)
assert.equal(objectParticlePresentation(shown,1800).alpha,1,'Actual SFC particle is already fully active while Sprite fade starts at zero')
const erased=statesAt(2900).get('bloom')
assert.equal(erased.activatedAt,1800)
assert.equal(objectParticlePresentation(erased,2900).stoppedAt,2400)
assert.equal(objectParticlePresentation(erased,3400).visible,false)
assert.ok(source.includes("runtime.entry.kind==='particle'?objectParticlePresentation"))
assert.ok(source.includes('state.activatedAt,particle?.stoppedAt'))
console.log('Native Object_layer particle Play without Sprite fade, StopEmitting cutoff, delayed deactivation, retained live particles and loop retirement passed')
