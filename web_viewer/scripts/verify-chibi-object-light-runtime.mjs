import assert from 'node:assert/strict'
import fs from 'node:fs'
import { oldSuspensionlightLayout } from '../src/core/chibiOldSuspensionlights.js'
const source=fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
const block=source.slice(source.indexOf('async function loadObjectLayerRuntime('),source.indexOf('function destroyObjectLayerRuntime('))
const pair=()=>({set(...v){this.values=v}})
class Sprite {constructor(texture){this.texture=texture;this.anchor=pair();this.position=pair();this.scale=pair();this.skew=pair()}}
class Container {constructor(){this.children=[]}addChild(s){this.children.push(s)}}
const load=new Function('PIXI','markRaw','loadImageLayerTexture',block+'\nreturn loadObjectLayerRuntime')(
 {Sprite,Container,BLEND_MODES:{ADD:1,NORMAL:0}},v=>v,async file=>({file}))
const instance={name:'mirror',texture:'beam',x:0,y:0,scaleX:1,scaleY:-1,rotation:-180,skewX:0,alpha:1,blendMode:'add'}
const entry={textures:[{id:'beam',file:'beam.png',pixelsPerUnit:100,pivot:{x:.5,y:.5}}],instances:[instance]}
const runtime=await load(entry),sprite=runtime.container.children[0]
assert.deepEqual(sprite.scale.values,[1,-1])
const point=(x,y)=>({x:Math.cos(sprite.rotation)*x*sprite.scale.values[0]-Math.sin(sprite.rotation)*y*sprite.scale.values[1],
 y:Math.sin(sprite.rotation)*x*sprite.scale.values[0]+Math.cos(sprite.rotation)*y*sprite.scale.values[1]})
assert.ok(Math.abs(point(0,100).y-100)<1e-8,'Native Y reflection must keep the wide lower beam at the bottom')
assert.ok(Math.abs(point(100,0).x+100)<1e-8,'Native Y reflection mirrors horizontally')
assert.deepEqual(sprite.skew.values,[0,0])
// Beam extent and source positions receive the same one-time viewport and
// environment registration. The camera parent is applied later, once.
const state={x:-200,y:600,scaleX:.8,scaleY:.8,coordinateScale:1,angle:40,mirror:false}
const full=oldSuspensionlightLayout(state,1280,720,1),half=oldSuspensionlightLayout(state,640,360,1)
assert.equal(half.scaleX/full.scaleX,.5)
assert.equal(half.scaleY/full.scaleY,.5)
assert.equal(half.x/full.x,.5)
assert.equal(half.y/full.y,.5)
const environment=oldSuspensionlightLayout(state,1280,720,2)
assert.equal(environment.scaleX/full.scaleX,2,'No squared environment scale')
const oldSync=source.slice(source.indexOf('function syncOldSuspensionlights('),source.indexOf('function releaseSpotlights('))
assert.ok(oldSync.includes('oldSuspensionlightLayout(state,width,height,environmentScale.value)'))
assert.ok(oldSync.includes('runtime.sprite.scale.set(layout.scaleX,layout.scaleY)'))
assert.ok(!oldSync.includes('cameraContainer.scale'),'Lamp consumer cannot rescale the camera parent')
console.log('PASS real object sprite signed scales, beam direction, and single viewport/environment registration')
