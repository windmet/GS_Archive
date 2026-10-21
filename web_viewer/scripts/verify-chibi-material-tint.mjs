import assert from 'node:assert/strict'
import fs from 'node:fs'
import {registerNativeParticleMaskRenderer} from '../src/core/chibiNativeParticleMask.js'
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)))
const model=read('public/data/stage-object-emitters.json').assets.fx_in_mtples_panel_2
const native=read('scripts/fixtures/chibi-object-emitters-native.json').objects.find(o=>o.asset==='fx_in_mtples_panel_2')
assert.equal(model.systems.length,10)
assert.equal(model.deferred.length,0)
const formulas=model.systems.filter(s=>s.name.startsWith('fx_in_mtples_formula_add_mask'))
assert.equal(formulas.length,6)
for(const system of model.systems){
  const source=native.particles.find(p=>p.pathId===system.source.pathId)
  const material=source.renderer.materials[0]
  assert.equal(material.shader.name,'Alpha Masked/Particles/Additive')
  assert.deepEqual(system.materialTint||[1,1,1,1],['r','g','b','a'].map(k=>2*material.colors._TintColor[k]))
}
// Exercise the actual batch renderer's uniforms across HDR and default contexts.
let Batch
class BatchRenderer {flush(){this._vertexCount=0}}
class BatchShaderGenerator {constructor(vertex,fragment){this.vertex=vertex;this.fragment=fragment}generateShader(){return {uniforms:{}}}}
const PIXI={BatchGeometry:class{},BatchRenderer,BatchShaderGenerator,ExtensionType:{RendererPlugin:1},extensions:{add(c){Batch=c}}}
PIXI.Texture={WHITE:{baseTexture:{identity:'white-alpha-one'}}}
registerNativeParticleMaskRenderer(PIXI)
const batch=new Batch({}),seen=[]
batch.setShaderGenerator()
assert.ok(batch.shaderGenerator.fragment.includes('color*=vColor*uMaterialTint;'))
assert.ok(batch.shaderGenerator.fragment.indexOf('color*=vColor*uMaterialTint;')<batch.shaderGenerator.fragment.indexOf('color.a=clamp'))
batch._shader=batch.shaderGenerator.generateShader()
batch.renderer={texture:{bind(){}},shader:{bind(shader){seen.push([...shader.uniforms.uMaterialTint])}}}
for(const tint of [[2,2,2,1],undefined,[.2,.4,.6,1.8]]){
  batch._vertexCount=4;batch.maskContext={sprite:{texture:{baseTexture:{}}},materialTint:tint};batch.flush()
}
assert.deepEqual(seen,[[2,2,2,1],[1,1,1,1],[.2,.4,.6,1.8]])
// Unmasked native additive emitters must use identity alpha with the same
// native RGBA blend, not Pixi's separate alpha factors.
const bindings=[]
batch.renderer.texture.bind=(texture,unit)=>bindings.push({texture,unit})
batch._vertexCount=4;batch.maskContext={sprite:null,kind:'add'};batch.flush()
assert.equal(bindings[0].texture,PIXI.Texture.WHITE.baseTexture)
assert.equal(bindings[0].unit,1)
assert.deepEqual(seen.at(-1),[1,1,1,1])
PIXI.Color={shared:{setValue(){return {toPremultiplied:()=>0xffffffff}}}}
const buffer=new ArrayBuffer(32*4),float32View=new Float32Array(buffer),uint32View=new Uint32Array(buffer),indices=[]
batch.vertexSize=8
batch.packInterleavedGeometry({vertexData:[0,0,2,0,2,2,0,2],uvs:[0,0,1,0,1,1,0,1],indices:[0,1,2,0,2,3],
  _texture:{baseTexture:{_batchLocation:0}},nativeParticleMask:{sprite:null},worldAlpha:.5}, {float32View,uint32View},indices,0,0)
for(let i=0;i<4;i++)assert.deepEqual([...float32View.slice(i*8+6,i*8+8)],[.5,.5])
batch.renderer.state={blendModes:[]};batch.renderer.gl={SRC_ALPHA:770,ONE:1,ONE_MINUS_SRC_ALPHA:771}
batch.initFlushBuffers=()=>{}
batch.contextChange()
assert.deepEqual(batch.renderer.state.blendModes[batch.nativeModes.add],[770,1])
const shader=read('scripts/fixtures/chibi-native-particle-masks.json').nativePrograms.add.fragmentTail
assert.ok(shader.includes('vs_COLOR0 + vs_COLOR0'))
assert.ok(shader.indexOf('* _TintColor')<shader.indexOf('clamp(u_xlat16_2'))
assert.ok(shader.indexOf('clamp(u_xlat16_2')<shader.indexOf('texture2D(_AlphaTex'))
console.log('Six formula systems retain native HDR material tint; batch context reset and native clamp/mask order passed')
