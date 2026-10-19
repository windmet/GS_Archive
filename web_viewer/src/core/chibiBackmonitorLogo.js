import { sampleStreamedCurve } from './chibiNativeAnimation.js'
import logoResources from './chibiBackmonitorLogoResources.json' with {type:'json'}
export const backmonitorLogoResources=logoResources

// Empty, unknown and same-name native requests preserve the current Sprite.
export function resolveBackmonitorLogo(model,events,milliseconds,requestedLogo=null) {
  if(!model)return null
  let asset=logoResources.defaultAsset
  if(events) {
    for(const event of events) {
      if(Number(event.time)>milliseconds)break
      if(Object.hasOwn(logoResources.models,event.logo))asset=event.logo
    }
  } else if(Object.hasOwn(logoResources.models,requestedLogo))asset=requestedLogo
  return {...model,...logoResources.models[asset],asset}
}

// Native sprite/curve/shader inputs and dictionary selection. Alpha follows
// native FadeAlpha; rotation phase remains reference-bounded. Mesh follows the
// recovered RotateSprite body; it does not establish Animator lifecycle parity.
export function logoFadeAt(events, milliseconds) {
  let alpha=0, target=0, origin=0, movie=null, tween=null
  const sample=time=>{
    if(!tween)return alpha
    const t=Math.max(0,Math.min(1,(time-tween.time)/500))
    return tween.from+(tween.to-tween.from)*(1-(1-t)**2)
  }
  for(const event of events || []) {
    const time=Number(event.time)
    if(time>milliseconds)break
    alpha=sample(time)
    const control=event.rawValue6 ?? event.rotation ?? 0
    const movieChanged=Boolean(event.movie && event.movie!==movie)
    if(movieChanged) {movie=event.movie;origin=time}
    const next=Number(control)===1 ? .8 : 0
    if(next && (!target || movieChanged))origin=time
    target=next
    // PlayMovie calls FadeAlpha on every command. Neither movie changes nor
    // repeated show/hide commands may reset the current material opacity.
    tween={from:alpha,to:target,time}
  }
  return {alpha:sample(milliseconds),movieTime:origin,movie}
}

export function sampleBackmonitorLogo(_songCode, state, milliseconds, model, events) {
  const fade=events
    ? logoFadeAt(events,milliseconds) : {alpha:state.rawValue6===1 ? .8 : 0,movieTime:state.movieTime}
  if (!model || !state.movie
      || fade.alpha <= .00001 || state.y >= 4000 || milliseconds < fade.movieTime) return null
  const seconds = (milliseconds - fade.movieTime) / 1000 % model.duration
  return { angle: sampleStreamedCurve(model.curve, seconds), seconds,alpha:fade.alpha }
}

export function logoProjectiveQuad(model, angle) {
  const f=Math.fround,phase=((angle%360)+360)%360,quadrant=Math.floor(phase/90)
  const perspectives=[0,model.perspectiveAngle,0,-model.perspectiveAngle,0]
  const radians=f(phase*f(Math.PI/180)),perspective=f(f(perspectives[quadrant]+f((perspectives[quadrant+1]-perspectives[quadrant])*f((phase%90)/90)))*f(Math.PI/180))
  const cos=f(Math.cos(radians)),pc=f(Math.cos(perspective)),ps=f(Math.sin(perspective))
  const hw=model.width/200,hh=model.height/200
  // Native Sprite order is TL, TR, BL, BR in Unity's Y-up plane.
  const points=[[-hw,hh],[hw,hh],[-hw,-hh],[hw,-hh]].map(([x,y])=>[f(cos*x),f(f(pc*y)+f(f(ps*x)*Math.sign(y)))])
  const [v0,v1,v2,v3]=points,dx=f(v0[0]-v3[0]),dy=f(v0[1]-v3[1]),ex=f(v2[0]-v1[0]),ey=f(v2[1]-v1[1])
  const den=f(f(ex*dy)-f(ey*dx)),sx=f(v1[0]-v3[0]),sy=f(v1[1]-v3[1])
  const cx=f(v1[0]+f(ex*f(f(f(dx*sy)-f(sx*dy))/den)))
  const cy=f(v1[1]+f(ey*f(f(f(ex*sy)-f(ey*sx))/den)))
  const distances=points.map(([x,y])=>f(Math.sqrt(f(f(f(x-cx)**2)+f(f(y-cy)**2)))))
  const weights=distances.map((d,i)=>{
    const opposite=distances[3-i]
    return opposite!==0&&!Number.isNaN(opposite)?f(f(d+opposite)/opposite):1
  })
  const vertices=[],uvq=[],factor=model.localScale*100
  for(const i of [0,1,3,2]) {
    const [x,y]=points[i],q=weights[i]
    vertices.push(f(x-cx)*factor,-y*factor)
    uvq.push((i%2)*q,(i<2?0:1)*q,q)
  }
  return { vertices: new Float32Array(vertices), uvq: new Float32Array(uvq) }
}

export function createBackmonitorLogoMesh(PIXI, parent, texture) {
  const geometry = new PIXI.Geometry()
    .addAttribute('aVertexPosition',new Float32Array(8),2)
    .addAttribute('aLogoUVQ',new Float32Array(12),3)
    .addIndex([0,1,2,0,2,3])
  const shader = PIXI.Shader.from(`
    attribute vec2 aVertexPosition;
    attribute vec3 aLogoUVQ;
    uniform mat3 translationMatrix;
    uniform mat3 projectionMatrix;
    varying vec3 vLogoUVQ;
    void main() {
      vLogoUVQ = aLogoUVQ;
      gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition,1.0)).xy,0.0,1.0);
    }`, `
    precision mediump float;
    varying vec3 vLogoUVQ;
    uniform sampler2D uSampler;
    uniform float uLogoAlpha;
    void main() { gl_FragColor = texture2D(uSampler,vLogoUVQ.xy/vLogoUVQ.z) * uLogoAlpha; }
    `, {uSampler:texture,uLogoAlpha:1})
  const mesh = new PIXI.Mesh(geometry,shader)
  // Parent sits behind the stage art. Logo sits over the movie and under
  // the independent blackout/whiteout transition in that same container.
  mesh.zIndex = -9999.5
  mesh.visible = false
  parent.addChild(mesh)
  return { mesh, geometry, shader }
}

export function updateBackmonitorLogoMesh(runtime, model, sample, projected) {
  runtime.shader.uniforms.uLogoAlpha=sample.alpha
  const quad = logoProjectiveQuad(model,sample.angle)
  runtime.geometry.getBuffer('aVertexPosition').update(quad.vertices)
  runtime.geometry.getBuffer('aLogoUVQ').update(quad.uvq)
  runtime.mesh.position.set(projected.x,projected.y)
  runtime.mesh.scale.set(projected.scale)
  runtime.mesh.visible = true
}

export function destroyBackmonitorLogoMesh(runtime) {
  runtime.mesh.removeFromParent()
  runtime.mesh.destroy()
  runtime.geometry.destroy()
  runtime.shader.destroy()
}
