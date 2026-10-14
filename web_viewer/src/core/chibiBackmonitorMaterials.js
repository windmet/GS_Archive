const nativeModes = new WeakMap()
const VERTEX = `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;
uniform mat3 projectionMatrix;
uniform mat3 translationMatrix;
uniform mat3 uTextureMatrix;
varying vec2 vTextureCoord;
void main() {
  gl_Position=vec4((projectionMatrix*translationMatrix*vec3(aVertexPosition,1.0)).xy,0.0,1.0);
  vTextureCoord=(uTextureMatrix*vec3(aTextureCoord,1.0)).xy;
}`

export function createBackmonitorLayer(PIXI, renderer, layer, texture) {
  if (layer.role === 'back') {
    const sprite = new PIXI.Sprite(texture)
    sprite.anchor.set(layer.anchorX,layer.anchorY)
    return sprite
  }
  const fragment = `
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform vec4 uColor;
    uniform float nativeAlpha;
    void main() {
      vec4 tex=texture2D(uSampler,vTextureCoord);
      vec3 straight=tex.a>0.0?tex.rgb/tex.a:vec3(0.0);
      // Native Mobile/Particles vertex stage clamps COLOR0, including authored 1.1 alpha.
      vec4 vertexColor=clamp(vec4(uColor.rgb,uColor.a*nativeAlpha),0.0,1.0);
      vec4 color=vec4(straight,tex.a)*vertexColor;
      ${layer.role === 'noise'
        ? 'gl_FragColor=vec4(1.0)+color.a*(color-vec4(1.0));'
        : 'gl_FragColor=color;'}
    }`
  const material = new PIXI.MeshMaterial(texture, {
    program: PIXI.Program.from(VERTEX,fragment), uniforms: { nativeAlpha:layer.alpha },
  })
  const w=texture.width,h=texture.height,x=-w*layer.anchorX,y=-h*layer.anchorY
  const mesh = new PIXI.Mesh(new PIXI.MeshGeometry(new Float32Array([x,y,x+w,y,x+w,y+h,x,y+h]),
    new Float32Array([0,0,1,0,1,1,0,1]),new Uint16Array([0,1,2,0,2,3])),material)
  if (!nativeModes.has(renderer)) {
    const noise=renderer.state.blendModes.length,glow=noise+1
    const restore=()=> {
      // Unity applies the same factors to RGB and alpha. Pixi ADD_NPM uses
      // separate alpha factors and therefore changes the render-target alpha.
      renderer.state.blendModes[noise]=[renderer.gl.ZERO,renderer.gl.SRC_COLOR]
      renderer.state.blendModes[glow]=[renderer.gl.SRC_ALPHA,renderer.gl.ONE]
    }
    restore()
    renderer.runners.contextChange.add({contextChange:restore})
    nativeModes.set(renderer,{noise,glow})
  }
  mesh.blendMode=nativeModes.get(renderer)[layer.role]
  return mesh
}

export function setBackmonitorLayerAlpha(node, alpha) {
  if (node.shader?.uniforms.nativeAlpha !== undefined) {
    node.shader.uniforms.nativeAlpha=alpha
    node.alpha=1 // Apply native vertex clamping explicitly in the material.
  } else node.alpha=alpha
}

export function destroyBackmonitorLayer(node) {
  node.removeFromParent()
  node.shader?.destroy()
  node.destroy()
}
