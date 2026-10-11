import { sampleStreamedCurve } from './chibiNativeAnimation.js'

// Native sprite/curve/shader inputs, bounded to the two recording-checked
// Take endings and Drive's recorded opening. Activation and geometry remain
// reference-calibrated until the director/RotateSprite bodies are recovered.
export function logoFadeAt(events, milliseconds) {
  let alpha=0, target=0, origin=0, movie=null, duration=0, tween=null
  const sample=time=>tween ? tween.from+(tween.to-tween.from)*Math.max(0,Math.min(1,(time-tween.time)/tween.duration)) : alpha
  for(const event of events || []) {
    const time=Number(event.time)
    if(time>milliseconds)break
    alpha=sample(time)
    const control=event.rawValue6 ?? event.rotation
    const rawDuration=event.rawValue7 ?? event.opacity
    if(rawDuration!=null)duration=Math.max(0,Number(rawDuration)||0)
    if(event.movie && event.movie!==movie) {movie=event.movie;origin=time;alpha=0;tween=null;target=0}
    if(control==null)continue
    const next=Number(control)===1 ? 1 : 0
    if(next===target)continue
    if(next)origin=time
    target=next
    tween=duration>0 ? {from:alpha,to:target,time,duration} : null
    if(!tween)alpha=target
  }
  return {alpha:sample(milliseconds),movieTime:origin,movie}
}

export function sampleBackmonitorLogo(songCode, state, milliseconds, model, events) {
  const fade=model?.fadeControls?.[songCode]==='raw-value7-ms' && events
    ? logoFadeAt(events,milliseconds) : {alpha:state.rawValue6===1 ? 1 : 0,movieTime:state.movieTime}
  if (!model?.previewSongs?.includes(songCode) || state.movie !== (model.previewMovies?.[songCode] || model.previewMovie)
      || fade.alpha <= .00001 || state.y >= 4000 || milliseconds < fade.movieTime) return null
  const seconds = (milliseconds - fade.movieTime) / 1000 % model.duration
  return { angle: sampleStreamedCurve(model.curve, seconds), seconds,alpha:fade.alpha }
}

export function logoProjectiveQuad(model, angle) {
  const radians = angle * Math.PI / 180
  const halfWidth = model.width * model.localScale / 2
  const halfHeight = model.height * model.localScale / 2
  const tangent = Math.tan(model.perspectiveAngle * Math.PI / 180)
  const vertices = [], uvq = []
  for (const [x,y,u,v] of [[-1,-1,0,0],[1,-1,1,0],[1,1,1,1],[-1,1,0,1]]) {
    const q = 1 / (1 - x * Math.sin(radians) * tangent)
    vertices.push(x * halfWidth * Math.cos(radians) * q, y * halfHeight * q)
    uvq.push(u*q,v*q,q)
  }
  // The native pivot is (0.5, 0.5): its projected rotation axis stays at
  // local (0, 0). Recentring the asymmetric perspective bounds would move
  // that texture pivot sideways as the logo turns.
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
  // Movie is a half-resolution 272px resource (x2); native Sprite is full-size.
  runtime.mesh.scale.set(projected.scale/2)
  runtime.mesh.visible = true
}

export function destroyBackmonitorLogoMesh(runtime) {
  runtime.mesh.removeFromParent()
  runtime.mesh.destroy()
  runtime.geometry.destroy()
  runtime.shader.destroy()
}
