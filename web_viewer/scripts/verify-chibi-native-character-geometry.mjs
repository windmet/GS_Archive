import assert from 'node:assert/strict'
import fs from 'node:fs'
import { nativeCharacterScale, nativeCharacterGeometry } from '../src/core/chibiNativeCharacterGeometry.js'
import { projectChibiGround } from '../src/core/chibiStageCoordinates.js'
import { characterShadowLayout } from '../src/core/chibiCharacterShadow.js'

const fixture = JSON.parse(fs.readFileSync(new URL('fixtures/chibi-native-character-geometry.json', import.meta.url)))
assert.deepEqual(nativeCharacterGeometry, fixture.model)
assert.equal(fixture.source.slots.length, 6)
assert.equal(fixture.source.bodies.length, 5)
let cases = 0
for (const slot of fixture.source.slots) for (const body of fixture.source.bodies) {
  for (const [width, height] of [[1280,720],[1036,583],[1920,1080],[357,201],[800,500]]) {
    const fit = Math.min(width/1280, height/720)
    // Independent Unity local vertex -> SkeletonDataAsset -> idol root ->
    // LiveStage scale -> orthographic camera. 1280x720 is letterboxed by Web.
    const unityPixels = 720 / (2*5) * (1000/720)
    const root = slot.tree.m_LocalScale
    const reference = body.scale * root.x * unityPixels * fit
    assert.ok(Math.abs(nativeCharacterScale(body.bodyType,width,height)-reference)<1e-12)
    const point = projectChibiGround('unlisted', {x:230,y:190},width,height)
    assert.ok(Math.abs(point.y-(height/2-((190-360)*.01)*unityPixels*fit))<1e-10)
    // Shadow is a sibling SpriteRenderer, not a skeleton-scaled texture.
    const spine={x:point.x,y:point.y,scale:{x:reference,y:reference},skeleton:{findBone:()=>({worldX:60,worldY:40})}}
    const shadow=characterShadowLayout(spine,{bone:'shadow',pixelsToSpineUnits:3})
    assert.ok(Math.abs(shadow.x-(point.x+60*reference))<1e-10)
    assert.ok(Math.abs(shadow.scaleX-root.x*unityPixels/100*fit)<1e-6)
    cases++
  }
}
assert.throws(()=>nativeCharacterScale(999,1280,720),/Unbound native/)
// Actual consumer must ignore stale published previewScale/height metadata.
const source=fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
const layout=source.match(/function layoutRuntime\([^]*?\n\}/)[0]
assert.ok(!/previewScale|height\s*\/\s*620|CHARACTER_STAGE_SCALE/.test(layout))
const actor={bodyType:5,spine:{scale:{set(value){this.x=this.y=value}}}}
const renderer={width:1280,height:720,resolution:1}
const apply=new Function('runtimes','app','canvasRef','stageTime','layoutCoordinatesForStage',
  'selectedSong','projectChibiGround','nativeCharacterScale','charactersEnabled','activePositions',
  'syncCharacterShadow','lightingEnabled','spotlightSortOffsetsAt',layout+';return layoutRuntime')(
    new Map([[3,actor]]),{renderer},{value:{}},{value:0},()=>({x:0,y:180,sortingOrder:1700}),
    {value:{songCode:'test'}},projectChibiGround,nativeCharacterScale,{value:true},{value:[3]},()=>{},
    {value:false},()=>new Map())
apply(3)
assert.equal(actor.spine.scale.x,nativeCharacterScale(5,1280,720))
renderer.width=2560;renderer.height=1440;apply(3)
assert.equal(actor.spine.scale.x,2*nativeCharacterScale(5,1280,720),'Large canvases cannot cap actor scale while art grows')
console.log(`PASS native idol root/skeleton/camera matrix: ${cases} body/slot/viewport cases, ground equivalence, shadow units and actual SFC resize`)
