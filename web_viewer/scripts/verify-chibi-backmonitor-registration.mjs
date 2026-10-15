import assert from 'node:assert/strict'
import fs from 'node:fs'
import {backmonitorRegistration,projectChibiBackmonitor} from '../src/core/chibiBackmonitorCoordinates.js'
import {nativeBackmonitorGeometry} from '../src/core/chibiBackmonitorGeometry.js'
import {backmonitorDepths} from '../src/core/chibiFlatStageLayers.js'
const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/chibi-backmonitor-geometry.json',import.meta.url),'utf8'))
assert.deepEqual(nativeBackmonitorGeometry,fixture.model)
const base=fixture.source.transforms.find(t=>t.type==='RectTransform'&&t.tree.m_AnchoredPosition.y>0)
assert.equal(base.tree.m_LocalPosition.y,0,'Witness retains the misleading serialized Transform cache')
assert.ok(Math.abs(base.tree.m_AnchoredPosition.y-1.35)<1e-6)
let checked=0
const check=(code,state)=> {
 for(const [width,height] of [[1280,720],[869,489],[357,201],[321,180],[800,500]]) {
  for(const environmentScale of [.85,1,1.073]) {
   const fit=Math.min(width/1280,height/720)*environmentScale
   const root=state.scale/1000
   const movie=projectChibiBackmonitor(code,state,width,height,environmentScale)
   // Independent root -> anchored Base -> centred native rectangle matrix.
   assert.ok(Math.abs(movie.x-(width/2+state.x*fit))<1e-8)
   assert.ok(Math.abs(movie.y-(height/2+(360-state.y)*fit-1.35*100*root*fit))<1e-8)
   assert.ok(Math.abs(movie.width-32/100*16.25*100*root*fit)<1e-8)
   assert.ok(Math.abs(movie.height-32/100*8.4375*100*root*fit)<1e-8)
   assert.ok(Math.abs(movie.scale-root*fit)<1e-8)
   assert.ok(Math.abs(movie.y+movie.height/2-(height/2+(360-state.y)*fit))<1e-8,
    'Scripted point owns the bottom of the screen for every root scale')
   assert.deepEqual(movie,projectChibiBackmonitor('unlisted-song',state,width,height,environmentScale),
    'Song names cannot select a registration exception')
   assert.ok(Object.values(movie).every(Number.isFinite));checked++
  }
 }
}
for(const code of ['jfhtmk','tkstp1','tkstp2','psblts','cgtocc','flslgt']) {
 assert.equal(backmonitorRegistration(code).id,'native-backmonitor-plane-v1')
 for(const scale of [0,600,920,1000,1300,1800])check(code,{x:75,y:280,scale})
}
if(process.argv.includes('--published-assets')) {
 const songs=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/choreography/index.json',import.meta.url),'utf8')).songs
 for(const song of songs)for(const event of song.backmonitorEvents||[])check(song.songCode,event)
}
const source=fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
assert.ok(source.includes('backmonitorSprite.width = projected.width'))
assert.ok(source.includes('backmonitorSprite.height = projected.height'))
assert.ok(source.includes('backmonitorTransitionSprite.width = projected.width'))
assert.ok(source.includes('backmonitorTransitionSprite.height = projected.height'))
assert.ok(!source.includes('backmonitorSprite.scale.set(projected.scale)'))
assert.ok(!source.includes('scale=projected.scale/2'))
assert.ok(!source.includes('backmonitorDepths(state,stageBackgroundNativeLayers.value)'))
assert.ok(source.includes('backmonitorTransitionSprite.zIndex = depths.transition'))
const logo=fs.readFileSync(new URL('../src/core/chibiBackmonitorLogo.js',import.meta.url),'utf8')
assert.ok(logo.includes('runtime.mesh.scale.set(projected.scale)'))
const layoutCode=source.slice(source.indexOf('function layoutBackmonitor('),source.indexOf('function syncBackmonitorLayers('))
for(const composite of [false,true]) {
 const sprite=()=>({position:{set(x,y){this.x=x;this.y=y},copyFrom(p){this.x=p.x;this.y=p.y}},scale:{}})
 const context={backmonitorSprite:sprite(),backmonitorTransitionSprite:sprite(),app:{renderer:{width:1280,height:720,resolution:1}},
  selectedSong:{value:{songCode:'jfhtmk'}},environmentScale:{value:1},backmonitorEnabled:{value:true},
  stageBackgroundSprite:composite?{}:null,projectChibiBackmonitor,backmonitorDepths,
  syncBackmonitorLogo(){},syncBackmonitorLayers(){}}
 const layout=new Function('c',`with(c){${layoutCode};return layoutBackmonitor}`)(context)
 layout({x:75,y:280,scale:1300,sortingOrder:1250,movie:'movie'})
 const {backmonitorSprite:movie,backmonitorTransitionSprite:transition}=context
 assert.equal(movie.position.y,264.5);assert.equal(movie.width,676);assert.equal(movie.height,351)
 assert.equal(transition.width,movie.width);assert.equal(transition.height,movie.height)
 assert.equal(transition.position.y,movie.position.y)
 assert.equal(movie.zIndex,composite?-30000:1250)
 assert.equal(transition.zIndex,movie.zIndex+2)
}
console.log(`Native backmonitor RectTransform / fixed renderer dimensions: ${checked} layouts; root-scale-dependent Base offset, viewport, media-independent geometry, transition/logo/layer wiring and no song exceptions passed`)
