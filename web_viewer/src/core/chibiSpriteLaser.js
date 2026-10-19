import model from './chibiSpriteLaserModel.json' with { type: 'json' }
import { sampleStreamedCurve } from './chibiNativeAnimation.js'

export const spriteLaserModel = model
export { updateNativeLightMaterial as updateSpriteLaserMaterial } from './chibiLightQuad.js'
import { createNativeLightQuad } from './chibiLightQuad.js'
const multiply = (l, r) => ({
  a:l.a*r.a+l.c*r.b, b:l.b*r.a+l.d*r.b,
  c:l.a*r.c+l.c*r.d, d:l.b*r.c+l.d*r.d,
  tx:l.a*r.tx+l.c*r.ty+l.tx, ty:l.b*r.tx+l.d*r.ty+l.ty,
})

export function sampleSpriteLaser(state, milliseconds, native = model) {
  if (Number(state.style) !== native.style || milliseconds < state.eventTime || state.alpha <= 0) return []
  const speed = Math.fround(2 / Math.fround(Number(state.sweepDuration)/1000))
  if (!Number.isFinite(speed)) return []
  const angle = Number(state.angle)*Math.PI/180, c=Math.cos(angle), s=Math.sin(angle)
  // PlayEffect uses ScriptPosToStagePos; direction changes parent X rotation
  // by 180 degrees (Y reflection in the flat sprite plane), not a fan angle.
  const mirror = state.direction === 'right' ? 1 : -1
  const outer = {a:c,b:s,c:-s*mirror,d:c*mirror,tx:0,ty:0}
  return native.layers.map(layer => {
    const seconds = (milliseconds-state.eventTime)/1000*speed % layer.duration
    let matrix = outer
    for (const [index,t] of layer.chain.entries()) {
      const radians = index === layer.animationIndex
        ? sampleStreamedCurve(layer.curve,seconds)*Math.PI/180
        : 2*Math.atan2(t.rotation.z,t.rotation.w)
      const c=Math.cos(radians), s=Math.sin(radians)
      matrix=multiply(matrix,{a:c*t.scale.x,b:s*t.scale.x,c:-s*t.scale.y,d:c*t.scale.y,
        tx:t.position.x*100,ty:t.position.y*100})
    }
    // Unity Y-up to texture/screen Y-down, including pivot translation.
    return {a:matrix.a,b:-matrix.b,c:-matrix.c,d:matrix.d,tx:matrix.tx,ty:-matrix.ty}
  })
}

export function createSpriteLaserRuntime(PIXI, parent, layers, textures, renderer) {
  const container = new PIXI.Container()
  const sprites = layers.map((layer,index) => {
    const sprite=createNativeLightQuad(PIXI,renderer,textures[index],layer.anchorX,layer.anchorY)
    container.addChild(sprite)
    return sprite
  })
  parent.addChild(container)
  return {container,sprites}
}

export function applySpriteLaserRuntime(PIXI, runtime, state, time, width, height, environmentScale=1) {
  const matrices=sampleSpriteLaser(state,time)
  const fit=Math.min(width/1280,height/720)*environmentScale
  runtime.container.position.set(width/2+Number(state.x)*fit,height/2+(360-Number(state.y))*fit)
  runtime.container.scale.set(Math.fround(Number(state.length)/1000)*fit)
  runtime.container.zIndex=Number(state.depth)
  runtime.container.visible=matrices.length>0
  for(const [i,sprite] of runtime.sprites.entries()) {
    const m=matrices[i]
    sprite.visible=Boolean(m)
    if(!m)continue
    sprite.transform.setFromMatrix(new PIXI.Matrix(m.a,m.b,m.c,m.d,m.tx,m.ty))
    sprite.tint=Number.parseInt(state.color.slice(1,7),16)
    // The old index calls value10 "width". Native SetColor uses it as alpha;
    // value6 ("length") scales both axes. Do not invent a white line core.
    sprite.alpha=Math.fround(Number(state.width)/1000)*state.alpha
  }
  return matrices.length
}
