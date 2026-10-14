import assert from 'node:assert/strict'
import fs from 'node:fs'
import { Container, Sprite, Texture } from 'pixi.js'
import { createObjectRendererPlanes, syncObjectRendererPlanes, releaseObjectRendererPlanes } from '../src/core/chibiObjectRendererPlanes.js'

const PIXI={Container},scene=new Container(),camera=new Container(),root=new Container(),group=new Container()
scene.addChild(camera);camera.addChild(root);root.addChild(group)
camera.position.set(400,220);camera.scale.set(.7);camera.rotation=.13
root.position.set(-100,35);root.scale.set(1.3);root.rotation=-.2;root.alpha=.8;root.zIndex=1700
group.position.set(10,-12);group.skew.set(.1,0);group.alpha=.7
const a=new Sprite(Texture.EMPTY),b=new Sprite(Texture.EMPTY),mask=new Sprite(Texture.EMPTY)
root.addChild(mask);group.mask=mask;group.addChild(a,b)
a.position.set(30,40);a.scale.set(2);a.alpha=.4;a.zIndex=1
b.position.set(-10,50);b.rotation=.8;b.zIndex=2
const runtime={container:root,entry:{keepOriginalOrder:true},floorEmitters:[{sprites:[a]},{sprites:[b]}]}
function update(){const prev=scene.enableTempParent();scene.updateTransform();scene.disableTempParent(prev)}
function painted(s){return [...['a','b','c','d','tx','ty'].map(k=>s.worldTransform[k]),s.worldAlpha]}
update();const before=[painted(a),painted(b),painted(mask)]
createObjectRendererPlanes(PIXI,runtime,camera);update()
assert.equal(root.renderable,false)
assert.deepEqual(runtime.rendererPlanes.map(p=>p.plane.zIndex),[1701,1702])
assert.deepEqual([painted(a),painted(b),painted(mask)],before,'renderer and mask transforms/alpha survive partition')
assert(runtime.rendererPlanes.every(p=>p.plane.parent===camera))
assert(runtime.rendererPlanes.every(p=>[...p.ancestors.values()].some(g=>g.mask===mask)))
root.zIndex=1599;root.visible=false;syncObjectRendererPlanes(runtime)
assert.deepEqual(runtime.rendererPlanes.map(p=>p.plane.zIndex),[1600,1601])
assert(runtime.rendererPlanes.every(p=>!p.plane.visible))
root.visible=true;root.scale.set(.5);syncObjectRendererPlanes(runtime);update()
assert(runtime.rendererPlanes.every(p=>p.plane.scale.x===.5))
const count=camera.children.length;createObjectRendererPlanes(PIXI,runtime,camera);assert.equal(camera.children.length,count)
releaseObjectRendererPlanes(runtime);assert(a.destroyed&&b.destroyed);assert(!mask.destroyed)
releaseObjectRendererPlanes(runtime);root.destroy({children:true});assert(mask.destroyed)
const root2=new Container(),x=new Sprite(Texture.EMPTY),y=new Sprite(Texture.EMPTY)
root2.zIndex=1700;x.zIndex=1;y.zIndex=2;root2.addChild(x,y);camera.addChild(root2)
const reset={container:root2,entry:{keepOriginalOrder:false}}
createObjectRendererPlanes(PIXI,reset,camera)
assert.equal(reset.rendererPlanes.length,1);assert.equal(reset.rendererPlanes[0].plane.zIndex,1700)
releaseObjectRendererPlanes(reset);root2.destroy({children:true});scene.destroy({children:true})

// Current authored witnesses; these are source-model checks, not native device acceptance.
const base=new URL('../public/assets/live-chibi/',import.meta.url)
const floors=JSON.parse(fs.readFileSync(new URL('floor-particles/index.json',base))).assets
const objects=JSON.parse(fs.readFileSync(new URL('object-layers/index.json',base))).assets
assert.equal(objects.fx_in_knwonl_panel.keepOriginalOrder,true)
assert.deepEqual([...new Set(floors.fx_in_knwonl_panel.systems.map(s=>s.sortingOrder))].sort(),[1,2])
const songs=JSON.parse(fs.readFileSync(new URL('choreography/index.json',base))).songs
const cue=songs.find(s=>s.songCode==='knwonl').objectLayerEvents.find(e=>e.asset==='fx_in_knwonl_panel'&&!e.hide)
assert.equal(cue.depth,1700)
console.log('Native per-renderer offsets, keep/reset semantics, mask transforms, visibility, disposal and actual 1700+1/+2 witness passed')
