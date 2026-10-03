import { sampleStreamedCurve } from './chibiNativeAnimation.js'

// Native sprite/curve/shader inputs, bounded to the two recording-checked
// Take endings. Activation, phase reset and perspective geometry remain
// reference-calibrated until the director/RotateSprite bodies are recovered.
export function sampleBackmonitorLogo(songCode, state, milliseconds, model) {
  if (!model?.previewSongs?.includes(songCode) || state.movie !== model.previewMovie
      || state.rawValue6 !== 1 || state.y >= 4000 || milliseconds < state.movieTime) return null
  const seconds = (milliseconds - state.movieTime) / 1000 % model.duration
  return { angle: sampleStreamedCurve(model.curve, seconds), seconds }
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
    void main() { gl_FragColor = texture2D(uSampler,vLogoUVQ.xy/vLogoUVQ.z); }
    `, {uSampler:texture})
  const mesh = new PIXI.Mesh(geometry,shader)
  // Parent sits behind the stage art. Logo sits over the movie and under
  // the independent blackout/whiteout transition in that same container.
  mesh.zIndex = -9999.5
  mesh.visible = false
  parent.addChild(mesh)
  return { mesh, geometry, shader }
}

export function updateBackmonitorLogoMesh(runtime, model, sample, projected) {
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
