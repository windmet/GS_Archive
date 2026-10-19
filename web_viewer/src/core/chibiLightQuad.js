// APK Shader950 (Mobile/Particles/Additive) clamps vertex COLOR0 to 0..1,
// multiplies the texture, then blends SrcAlpha/One. Preserve fractional
// alpha until this explicit native shader boundary, before premultiplication.
export const NATIVE_LIGHT_VERTEX = `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;
uniform mat3 projectionMatrix;
uniform mat3 translationMatrix;
uniform mat3 uTextureMatrix;
varying vec2 vTextureCoord;
void main(void) {
  gl_Position=vec4((projectionMatrix*translationMatrix*vec3(aVertexPosition,1.0)).xy,0.0,1.0);
  vTextureCoord=(uTextureMatrix*vec3(aTextureCoord,1.0)).xy;
}`

export const NATIVE_LIGHT_FRAGMENT = `
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec4 uColor;
uniform float uTexturePremultiplied;
void main(void) {
  vec4 color=texture2D(uSampler,vTextureCoord);
  if(uTexturePremultiplied>0.5 && color.a>0.0) color.rgb/=color.a;
  gl_FragColor=color*uColor;
}`

export function updateNativeLightMaterial() {
  const tint=this.tint, alpha=Math.max(0,Math.min(1,this.alpha))
  const color=this.uniforms.uColor
  color[0]=(tint>>16&255)/255
  color[1]=(tint>>8&255)/255
  color[2]=(tint&255)/255
  color[3]=alpha
  this.uniforms.uTexturePremultiplied=this.texture.baseTexture.alphaMode ? 1 : 0
  if(this.uvMatrix.update())this.uniforms.uTextureMatrix=this.uvMatrix.mapCoord
}

export function createNativeLightQuad(PIXI,texture,anchorX,anchorY,width=texture.width,height=texture.height) {
  const x=-width*anchorX,y=-height*anchorY
  const mesh=new PIXI.SimpleMesh(texture,
    new Float32Array([x,y,x+width,y,x+width,y+height,x,y+height]),
    new Float32Array([0,0,1,0,1,1,0,1]),new Uint16Array([0,1,2,0,2,3]))
  // Native blend is SrcAlpha/One for RGB and alpha. Use straight output so
  // ADD_NPM reproduces both channels, including alpha accumulation (a*a).
  mesh.shader=new PIXI.MeshMaterial(texture,{program:PIXI.Program.from(NATIVE_LIGHT_VERTEX,NATIVE_LIGHT_FRAGMENT),
    uniforms:{uTexturePremultiplied:texture.baseTexture?.alphaMode ? 1 : 0}})
  mesh.shader.batchable=false
  mesh.shader.update=updateNativeLightMaterial
  mesh.blendMode=PIXI.BLEND_MODES.ADD_NPM
  mesh.nativeAnchorX=anchorX
  mesh.nativeAnchorY=anchorY
  return mesh
}

export function updateNativeLightQuadAnchor(mesh,anchorX,anchorY) {
  if(mesh.nativeAnchorX===anchorX && mesh.nativeAnchorY===anchorY)return
  mesh.vertices.set([-anchorX,-anchorY,1-anchorX,-anchorY,1-anchorX,1-anchorY,-anchorX,1-anchorY])
  mesh.nativeAnchorX=anchorX
  mesh.nativeAnchorY=anchorY
}
