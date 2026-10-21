import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createSpriteTweenState,dispatchSpriteTween,stepSpriteTweens,createObjectSpriteTimeline,supportsObjectSpriteTweens} from '../src/core/chibiObjectSpriteTweens.js'
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)))
const native=read('scripts/fixtures/chibi-object-sprite-tween-native.json')
let frames=0
for (const test of native.cases) {
  const state=createSpriteTweenState([test.initialAlpha]),history=new Map()
  for (const [i,action] of test.actions.entries()) {
    if (action[0]==='add') history.set(action[1],dispatchSpriteTween(state,action[2]===0,action[3],action[1]))
    else if (action[0]==='external-alpha') state.alphas[0]=Math.fround(action[1])
    else {stepSpriteTweens(state,action[1]);frames++}
    const expected=test.observations[i]
    assert.ok(Math.abs(state.alphas[0]-expected.color[3])<2e-7,`${test.name} action ${i}: native alpha`)
    assert.equal(state.active,expected.active,`${test.name} action ${i}: native active`)
    assert.deepEqual(state.tweens.map(t=>t.id),expected.activeSlots.filter(Boolean),`${test.name}: native array order`)
    for (const [name,start] of Object.entries(expected.starts)) {
      assert.equal(Boolean(history.get(name).from),start.captured,`${test.name}: lazy Startup ${name}`)
      if (start.captured) assert.ok(Math.abs(history.get(name).from[0]-start.alpha)<2e-7)
    }
  }
}
for (const track of native.referenceTracks) {
  const timeline=createObjectSpriteTimeline(track.events,[track.initialAlpha])
  for (const sample of track.samples) {
    const actual=timeline.sample(sample.milliseconds)
    assert.ok(Math.abs(actual.alphas[0]-sample.alpha)<2e-7,`${track.asset}@${sample.milliseconds}: native reference clock`)
    assert.equal(actual.active,sample.active,`${track.asset}: native command/callback clock`)
  }
  for (const sample of track.samples.slice().reverse()) {
    const actual=timeline.sample(sample.milliseconds)
    assert.ok(Math.abs(actual.alphas[0]-sample.alpha)<2e-7,'Rewind must replay the same native reference samples')
    assert.equal(actual.active,sample.active)
  }
}
// Different child alphas must converge to the target independently, without a
// fixed initial-alpha factor on the parent. Repeated timestamps are idempotent.
const commands=[{time:0,duration:1000,hide:false},{time:1200,duration:1,hide:true},{time:1400,duration:1000,hide:false}]
const timeline=createObjectSpriteTimeline(commands,[1,.588235])
assert.deepEqual(timeline.sample(1100).alphas,[1,1])
assert.equal(timeline.sample(1300).active,false)
const late=timeline.sample(1600)
assert.deepEqual(timeline.sample(1600),late)
timeline.sample(100)
assert.deepEqual(timeline.sample(1600),late,'Rewind replays the same reference frames')
assert.deepEqual(createObjectSpriteTimeline(commands,[1,.588235]).sample(1600),late,'Cold seek equals incremental replay')
const firstErase=createObjectSpriteTimeline([{time:0,duration:1000,hide:true}],[1])
assert.equal(firstErase.sample(0).active,true,'First GetOrCreate activates the preloaded root')
assert.equal(firstErase.sample(1100).active,false)
assert.throws(()=>createObjectSpriteTimeline([{time:10,duration:1},{time:0,duration:1}],[1]))
assert.throws(()=>dispatchSpriteTween(createSpriteTweenState([1]),false,-1))
assert.equal(supportsObjectSpriteTweens({kind:'particle'}),false)
assert.equal(supportsObjectSpriteTweens({kind:'sprite',particleCount:0,groupCount:1,instances:[{}]}),false)
assert.equal(supportsObjectSpriteTweens({kind:'sprite',particleCount:0,groupCount:0,instances:[{}],nativeSpriteShader:{}}),false)
// Exercise the actual SFC presentation/layout assignments, including renderer
// planes seeing per-child alpha rather than a second parent fade multiplier.
const source=fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
const helper=source.slice(source.indexOf('function objectSpritePresentationAt('),source.indexOf('function layoutObjectLayers('))
const layout=source.slice(source.indexOf('function layoutObjectLayers('),source.indexOf('function releaseObjectLayers('))
const entry={kind:'sprite',particleCount:0,groupCount:0,instances:[{alpha:1},{alpha:.588235}]}
const runtime={entry,container:{position:{set(){}},scale:{set(){}}},objectSprites:[{},{}]}
const at={asset:'test',x:0,y:360,scale:1000,depth:1650,alpha:.5}
const env={app:{renderer:{width:1280,height:720,resolution:1}},objectLayerRuntimes:new Map([['test',runtime]]),
  objectLayerIndex:{value:{assets:{test:entry}}},objectSpriteTimelines:new Map(),
  selectedSong:{value:{objectLayerEvents:[{asset:'test',time:8700,duration:1000,hide:false}]}},
  createObjectSpriteTimeline,supportsObjectSpriteTweens,stageTime:{value:9200},environmentScale:{value:1},
  objectLayersEnabled:{value:true},playing:{value:false},inspectorOpen:{value:false},
  nativeObjectParticleCount:{value:0},bloomParticleCount:{value:0},floorParticleState:{value:''},
  particleLayerFrames:{value:''},objectSpriteTweenState:{value:''},applyObjectSpriteGeometry(){},
  syncObjectRendererPlanes(){assert.equal(runtime.container.alpha,1)}}
const paint=new Function(...Object.keys(env),helper+layout+';return layoutObjectLayers')(...Object.values(env))
paint(new Map([['test',at]]))
assert.equal(runtime.container.visible,true)
assert.equal(runtime.objectSprites[0].alpha,1)
assert.ok(runtime.objectSprites[1].alpha>.588235 && runtime.objectSprites[1].alpha<1)
env.stageTime.value=9800
paint(new Map([['test',at]]))
assert.deepEqual(runtime.objectSprites.map(s=>s.alpha),[1,1])
console.log(`Sprite tween kernel: ${native.cases.length} native ARM64 cases / ${frames} frames, ${native.referenceTracks.length} RAW reference tracks, child alpha, callbacks, old tweens and cold/rewind checks passed`)
