import { localHeightRow } from './chibiFootLighting.js'

const VERTEX = `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;
uniform mat3 projectionMatrix;
uniform mat3 translationMatrix;
uniform mat3 uTextureMatrix;
uniform vec3 nativeHeightRow;
uniform float nativeRcpHeight;
varying vec2 vTextureCoord;
varying float vNativeHeight;
void main() {
  vec3 world=translationMatrix*vec3(aVertexPosition,1.0);
  gl_Position=vec4((projectionMatrix*world).xy,0.0,1.0);
  vNativeHeight=dot(world,nativeHeightRow)*nativeRcpHeight;
  vTextureCoord=(uTextureMatrix*vec3(aTextureCoord,1.0)).xy;
}`
export const BODY_FRAGMENT = `
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec4 uColor;
uniform vec4 nativeBody;
uniform vec4 nativeFoot;
varying float vNativeHeight;
void main() {
  vec4 tex=texture2D(uSampler,vTextureCoord);
  vec3 rgb=mix(tex.rgb,nativeBody.rgb*tex.a,nativeBody.a);
  rgb=mix(rgb,nativeFoot.rgb*tex.a,nativeFoot.a*(1.0-clamp(vNativeHeight,0.0,1.0)));
  gl_FragColor=vec4(rgb,tex.a)*uColor;
}`

const PLUGIN = 'chibiNativeBody'
const registered = new WeakSet()
export function registerNativeBodyRenderer(PIXI) {
  if (registered.has(PIXI)) return
  class BodyGeometry extends PIXI.BatchGeometry {
    constructor(...args) {
      super(...args)
      this.addAttribute('aNativeBody', this._buffer, 4, false, PIXI.TYPES.FLOAT)
      this.addAttribute('aNativeFoot', this._buffer, 4, false, PIXI.TYPES.FLOAT)
      this.addAttribute('aNativeHeight', this._buffer, 1, false, PIXI.TYPES.FLOAT)
    }
  }
  class BodyBatch extends PIXI.BatchRenderer {
    constructor(renderer) { super(renderer); this.geometryClass = BodyGeometry; this.vertexSize = 15 }
    setShaderGenerator() {
      this.shaderGenerator = new PIXI.BatchShaderGenerator(`
        attribute vec2 aVertexPosition;
        attribute vec2 aTextureCoord;
        attribute vec4 aColor;
        attribute float aTextureId;
        attribute vec4 aNativeBody;
        attribute vec4 aNativeFoot;
        attribute float aNativeHeight;
        uniform mat3 projectionMatrix;
        uniform mat3 translationMatrix;
        uniform vec4 tint;
        varying vec2 vTextureCoord;
        varying vec4 vColor;
        varying float vTextureId;
        varying vec4 vNativeBody;
        varying vec4 vNativeFoot;
        varying float vNativeHeight;
        void main() {
          gl_Position=vec4((projectionMatrix*translationMatrix*vec3(aVertexPosition,1.0)).xy,0.0,1.0);
          vTextureCoord=aTextureCoord; vColor=aColor*tint;
          vTextureId=aTextureId; vNativeBody=aNativeBody;
          vNativeFoot=aNativeFoot; vNativeHeight=aNativeHeight;
        }`, `
        varying vec2 vTextureCoord;
        varying vec4 vColor;
        varying float vTextureId;
        varying vec4 vNativeBody;
        varying vec4 vNativeFoot;
        varying float vNativeHeight;
        uniform sampler2D uSamplers[%count%];
        void main() {
          vec4 color;
          %forloop%
          color.rgb=mix(color.rgb,vNativeBody.rgb*color.a,vNativeBody.a);
          color.rgb=mix(color.rgb,vNativeFoot.rgb*color.a,vNativeFoot.a*(1.0-clamp(vNativeHeight,0.0,1.0)));
          gl_FragColor=color*vColor;
        }`)
    }
    packInterleavedGeometry(element, buffer, indices, a, i) {
      const packed = a / this.vertexSize, { float32View: floats, uint32View: words } = buffer
      const vertices = element.vertexData, uv = element.uvs, texture = element._texture.baseTexture
      const color = PIXI.Color.shared.setValue(element._tintRGB)
        .toPremultiplied(Math.min(element.worldAlpha, 1), texture.alphaMode > 0)
      for (let v = 0; v < vertices.length; v += 2) {
        floats[a++] = vertices[v]; floats[a++] = vertices[v + 1]
        floats[a++] = uv[v]; floats[a++] = uv[v + 1]
        words[a++] = color; floats[a++] = texture._batchLocation
        for (const channel of element.nativeBodyRgba) floats[a++] = channel
        for (const channel of element.nativeFootRgba) floats[a++] = channel
        const row = element.nativeFootHeightRow
        floats[a++] = (vertices[v]*row[0]+vertices[v+1]*row[1]+row[2])*element.nativeFootRcpHeight
      }
      for (const index of element.indices) indices[i++] = packed + index
    }
  }
  BodyBatch.extension = { name: PLUGIN, type: PIXI.ExtensionType.RendererPlugin }
  PIXI.extensions.add(BodyBatch)
  registered.add(PIXI)
}

// Keep replacement before per-slot vertex tint/alpha and before compositing.
// Region sprites use a draw-time quad; deformed meshes keep their own geometry.
// Inactive uniforms retain the original batched Spine renderer.
export function syncNativeBodyColor(PIXI, runtime, rgba, enabled, foot) {
  let paint = runtime.nativeBodyPaint
  if (!paint && enabled && (rgba?.[3] > 0 || foot?.rgba?.[3] > 0)) {
    const spine = runtime.spine
    paint = { active: false, rgba: new Float32Array([1, 1, 1, 0]), foot: new Float32Array(4),
      heightRow: new Float32Array(3), rcpHeight: 0, nodes: new Map(), factories: [] }
    const material = texture => new PIXI.MeshMaterial(texture, {
      program: PIXI.Program.from(VERTEX, BODY_FRAGMENT), uniforms: { nativeBody: paint.rgba,
        nativeFoot: paint.foot, nativeHeightRow: paint.heightRow, nativeRcpHeight: paint.rcpHeight },
    })
    const install = (node, mesh) => {
      if (paint.nodes.has(node)) return node
      const original = node._render
      const entry = { original, mesh, material: null, proxy: null }
      paint.nodes.set(node, entry)
      node._render = function(renderer) {
        if (!paint.active) return original.call(this, renderer)
        if (paint.foot[3] > 0) paint.heightRow.set(localHeightRow(spine.worldTransform))
        if (renderer.plugins?.[PLUGIN] && (!mesh || (this.shader.batchable
            && this.vertices.length < PIXI.Mesh.BATCHABLE_SIZE * 2 && this.drawMode === PIXI.DRAW_MODES.TRIANGLES))) {
          this.nativeBodyRgba = paint.rgba
          this.nativeFootRgba = paint.foot
          this.nativeFootHeightRow = paint.heightRow
          this.nativeFootRcpHeight = paint.rcpHeight
          const owner = mesh ? this.material : this, old = owner.pluginName
          owner.pluginName = PLUGIN
          try { return original.call(this, renderer) } finally { owner.pluginName = old }
        }
        if (mesh) {
          const old = this.shader
          entry.material ||= material(old.texture)
          entry.material.texture = old.texture
          entry.material.tint = old.tint
          entry.material.uniforms.nativeRcpHeight = paint.rcpHeight
          this.shader = entry.material
          try { return original.call(this, renderer) } finally { this.shader = old }
        }
        this.calculateVertices()
        entry.material ||= material(this.texture)
        entry.material.texture = this.texture
        entry.material.tint = this.tint
        entry.material.uniforms.nativeRcpHeight = paint.rcpHeight
        if (!entry.proxy) entry.proxy = new PIXI.Mesh(new PIXI.MeshGeometry(
          new Float32Array(8), new Float32Array(8), new Uint16Array([0, 1, 2, 0, 2, 3])), entry.material)
        const proxy = entry.proxy
        proxy.geometry.getBuffer('aVertexPosition').update(this.vertexData)
        // Sprite vertex UVs are already atlas mapped, including rotation/trim.
        proxy.geometry.getBuffer('aTextureCoord').update(this.texture._uvs.uvsFloat32)
        entry.material.uvMatrix.update()
        entry.material.uniforms.uTextureMatrix = PIXI.Matrix.IDENTITY
        proxy.worldAlpha = this.worldAlpha
        proxy.blendMode = this.blendMode
        // MeshMaterial.update would apply the atlas matrix a second time.
        const update = entry.material.update
        entry.material.update = function() { update.call(this); this.uniforms.uTextureMatrix = PIXI.Matrix.IDENTITY }
        try { proxy._render(renderer) } finally { entry.material.update = update }
      }
      entry.wrapper = node._render
      return node
    }
    for (const [name, mesh] of [['newSprite', false], ['newMesh', true]]) {
      const original = spine[name], owned = Object.hasOwn(spine, name)
      const wrapper = function(...args) { return install(original.apply(this, args), mesh) }
      spine[name] = wrapper
      paint.factories.push({ name, original, wrapper, owned })
    }
    for (const slot of spine.skeleton.slots) {
      for (const node of Object.values(slot.sprites || {})) install(node, false)
      for (const node of Object.values(slot.meshes || {})) install(node, true)
    }
    runtime.nativeBodyPaint = paint
  }
  if (!paint) return
  paint.rgba.set(rgba || [1, 1, 1, 0])
  paint.foot.set(foot?.rgba || [0,0,0,0])
  paint.rcpHeight = foot?.rcpHeight || 0
  paint.active = Boolean(enabled && (paint.rgba[3] > 0 || paint.foot[3] > 0))
}

export function releaseNativeBodyColor(runtime) {
  const paint = runtime?.nativeBodyPaint
  if (!paint) return
  for (const [node, entry] of paint.nodes) {
    if (node._render === entry.wrapper) node._render = entry.original
    if (node.nativeBodyRgba === paint.rgba) delete node.nativeBodyRgba
    if (node.nativeFootRgba === paint.foot) {
      delete node.nativeFootRgba; delete node.nativeFootHeightRow; delete node.nativeFootRcpHeight
    }
    entry.proxy?.destroy()
    entry.material?.destroy()
  }
  for (const { name, original, wrapper, owned } of paint.factories) {
    if (runtime.spine[name] !== wrapper) continue
    if (owned) runtime.spine[name] = original
    else delete runtime.spine[name]
  }
  runtime.nativeBodyPaint = null
}
