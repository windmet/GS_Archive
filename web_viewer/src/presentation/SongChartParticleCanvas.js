// One reusable GPU buffer per document; snapshots are copied into the existing
// Canvas2D effects layer so pause/seek pixel checks and UI composition stay intact.
let pipeline
function createPipeline() {
  const canvas = document.createElement('canvas')
  canvas.width = 1280; canvas.height = 720
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false })
  if (!gl) return null
  const compile = (type, source) => {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source); gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader))
    return shader
  }
  const program = gl.createProgram()
  const vertex = compile(gl.VERTEX_SHADER, `attribute vec3 position; attribute vec2 uv; attribute vec4 color;
    varying vec2 textureUV; varying vec4 tint;
    void main(){gl_Position=vec4((position.xy/vec2(640.0,360.0)-vec2(1.0))*vec2(1.0,-1.0)*position.z,0.0,position.z);textureUV=uv;tint=color;}`)
  const fragment = compile(gl.FRAGMENT_SHADER, `precision mediump float; varying vec2 textureUV; varying vec4 tint;
    uniform sampler2D image; void main(){gl_FragColor=texture2D(image,textureUV)*tint;}`)
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program)
  gl.deleteShader(vertex); gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program))
  gl.useProgram(program)
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  for (const [name, size, offset] of [['position', 3, 0], ['uv', 2, 12], ['color', 4, 20]]) {
    const attribute = gl.getAttribLocation(program, name)
    gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 36, offset)
  }
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
  // Store valid premultiplied coverage for the transparent Canvas2D copy.
  // Its SVG foreignObject must also use plus-lighter against the scene:
  // source-over would turn black additive coverage into a dark backdrop.
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE)
  gl.clearColor(0, 0, 0, 0); gl.viewport(0, 0, 1280, 720)
  const state = { canvas, gl, program, buffer, textures: new Map(), lost: false }
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); state.lost = true })
  return state
}

export function drawParticleCanvas(ctx, particles, images) {
  if (pipeline === undefined) {
    try { pipeline = createPipeline() } catch { pipeline = null }
  }
  if (!pipeline || pipeline.lost) return false
  const { gl, canvas, program, buffer, textures } = pipeline
  gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  const groups = new Map()
  for (const instruction of particles) {
    const image = images.get(instruction.textureId)
    if (!image?.naturalWidth || !instruction.quad.every(p => p.depth > 0)) continue
    let group = groups.get(instruction.textureId)
    if (!group) { group = { image, data: [] }; groups.set(instruction.textureId, group) }
    const { sx, sy, sw, sh, colorTint: tint, alpha, quad } = instruction
    const u = [sx / image.width, (sx + sw) / image.width], v = [1 - sy / image.height, 1 - (sy + sh) / image.height]
    for (const i of [0, 2, 1, 1, 2, 3]) {
      const p = quad[i]
      group.data.push(p.x, p.y, p.depth, u[i % 2], v[i < 2 ? 0 : 1], tint.r, tint.g, tint.b, alpha)
    }
  }
  for (const [id, { image, data }] of groups) {
    let texture = textures.get(id)
    if (!texture) {
      texture = gl.createTexture(); textures.set(id, texture)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    } else gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW)
    gl.drawArrays(gl.TRIANGLES, 0, data.length / 9)
  }
  ctx.drawImage(canvas, 0, 0)
  return true
}
