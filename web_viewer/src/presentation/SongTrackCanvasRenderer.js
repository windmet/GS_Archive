import { FLOATS_PER_VERTEX, JUDGE_BAND_HALF_HEIGHT, TRACK_TEXTURES } from './SongTrackCanvasFrame.js'

// The perspective track's single opaque WebGL surface. The browser composites one finished image per frame
// instead of rasterising SVG notes, a hold canvas and a plus-lighter effects canvas separately, which on
// Android Chrome let those layers reach the screen from different frames.
const LANE_GRADATION = '/assets/song-chart-track/live_lane_gradation.png'
const JUDGE_GRADATION = '/assets/song-chart-track/live_target_line_gradation.png'
const JUDGE_LINE = '/assets/song-chart-track/live_target_line.png'
const PARTICLE_FLOATS = 9 // x, y, depth, u, v, premultiplied r, g, b, a

const SPRITE_VERTEX = `attribute vec2 position; attribute vec2 uv; attribute vec4 color; varying vec2 textureUV; varying vec4 tint;
  void main(){ gl_Position=vec4((position/vec2(640.0,360.0)-vec2(1.0))*vec2(1.0,-1.0),0.0,1.0); textureUV=uv; tint=color; }`
const PARTICLE_VERTEX = `attribute vec3 position; attribute vec2 uv; attribute vec4 color; varying vec2 textureUV; varying vec4 tint;
  void main(){ gl_Position=vec4((position.xy/vec2(640.0,360.0)-vec2(1.0))*vec2(1.0,-1.0)*position.z,0.0,position.z); textureUV=uv; tint=color; }`
const FRAGMENT = `precision mediump float; varying vec2 textureUV; varying vec4 tint; uniform sampler2D image;
  void main(){ gl_FragColor=texture2D(image,textureUV)*tint; }`

const powerOfTwo = n => 2 ** Math.ceil(Math.log2(Math.max(1, n)))

export function createSongTrackCanvasRenderer(canvas, { onTextureReady = () => {}, onLost = () => {} } = {}) {
  const gl = canvas.getContext('webgl', { alpha: false, premultipliedAlpha: true, antialias: true, depth: false, stencil: false, preserveDrawingBuffer: false })
  if (!gl) return null
  let lost = false
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; onLost() })

  function program(vertexSource, layout) {
    const compile = (type, source) => {
      const shader = gl.createShader(type)
      gl.shaderSource(shader, source); gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Track shader compilation failed')
      return shader
    }
    const object = gl.createProgram(), vertex = compile(gl.VERTEX_SHADER, vertexSource), fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT)
    gl.attachShader(object, vertex); gl.attachShader(object, fragment); gl.linkProgram(object)
    gl.deleteShader(vertex); gl.deleteShader(fragment)
    if (!gl.getProgramParameter(object, gl.LINK_STATUS)) throw new Error('Track program linking failed')
    const buffer = gl.createBuffer(), stride = layout.reduce((sum, [, size]) => sum + size, 0) * 4
    const attributes = []
    let offset = 0
    for (const [name, size] of layout) { attributes.push([gl.getAttribLocation(object, name), size, offset]); offset += size * 4 }
    const use = () => {
      gl.useProgram(object)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      for (const [location, size, at] of attributes) { gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, at) }
    }
    return { object, buffer, use, capacity: 0 }
  }
  const sprites = program(SPRITE_VERTEX, [['position', 2], ['uv', 2], ['color', 4]])
  const particles = program(PARTICLE_VERTEX, [['position', 3], ['uv', 2], ['color', 4]])

  const textures = new Map(), loading = new Map()
  function store(key, source, { mipmap = true } = {}) {
    let entry = textures.get(key)
    if (!entry) textures.set(key, entry = { texture: gl.createTexture() })
    let pixels = source
    const width = source.naturalWidth || source.width, height = source.naturalHeight || source.height
    // WebGL1 mipmaps need power-of-two sizes. A distant note is a few pixels wide; without mips it shimmers.
    if (mipmap && (width !== powerOfTwo(width) || height !== powerOfTwo(height))) {
      pixels = document.createElement('canvas')
      pixels.width = Math.min(2048, powerOfTwo(width)); pixels.height = Math.min(2048, powerOfTwo(height))
      pixels.getContext('2d').drawImage(source, 0, 0, pixels.width, pixels.height)
    }
    gl.bindTexture(gl.TEXTURE_2D, entry.texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    if (mipmap) gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    entry.ready = true
  }
  // Decoded images are kept so the static surfaces can be repainted at a new size without refetching.
  function image(url) {
    if (!loading.has(url)) loading.set(url, new Promise((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = reject
      element.src = url
    }))
    return loading.get(url)
  }
  function texture(url) {
    const entry = textures.get(url)
    if (entry?.ready) return entry.texture
    if (!entry) {
      textures.set(url, { texture: gl.createTexture(), ready: false })
      image(url).then(element => { if (!lost) { store(url, element); onTextureReady() } }, () => {})
    }
    return null
  }
  const white = document.createElement('canvas')
  white.width = white.height = 1
  const pen = white.getContext('2d')
  pen.fillStyle = '#fff'; pen.fillRect(0, 0, 1, 1)
  store(TRACK_TEXTURES.white, white, { mipmap: false })

  // Static artwork the SVG used to draw: the lane field under everything, and the judgement line with its rings
  // between the middle nodes and the notes. Painted once per backing size at that size, so it stays sharp.
  let staticKey = ''
  async function paintStatic(scene, scale) {
    const key = `${canvas.width}x${canvas.height}`
    if (staticKey === key) return
    staticKey = key
    const [gradation, judgeGradation, judgeLine] = await Promise.all([LANE_GRADATION, JUDGE_GRADATION, JUDGE_LINE].map(url => image(url).catch(() => null)))
    if (lost || staticKey !== key) return
    const { width, height, lanes, topY, judgeY, judges } = scene
    const background = document.createElement('canvas')
    background.width = canvas.width; background.height = canvas.height
    const b = background.getContext('2d')
    b.scale(scale, scale)
    b.fillStyle = '#162b36'; b.fillRect(0, 0, width, height)
    const outline = () => {
      b.beginPath()
      b.moveTo(lanes[0].topX, topY); b.lineTo(lanes[5].topX, topY); b.lineTo(lanes[5].bottomX, height); b.lineTo(lanes[0].bottomX, height)
      b.closePath()
    }
    if (gradation) { b.save(); outline(); b.clip(); b.drawImage(gradation, 0, 0, width, height); b.restore() }
    outline(); b.fillStyle = 'rgba(7, 21, 27, .25)'; b.fill()
    lanes.forEach((lane, i) => {
      const edge = i === 0 || i === 5
      b.beginPath(); b.moveTo(lane.topX, topY); b.lineTo(lane.bottomX, height)
      b.strokeStyle = edge ? 'rgba(145, 229, 232, .7)' : 'rgba(164, 186, 198, .5)'; b.lineWidth = edge ? 5 : 1.2; b.stroke()
    })
    store(TRACK_TEXTURES.background, background, { mipmap: false })
    const band = document.createElement('canvas')
    band.width = canvas.width; band.height = Math.ceil(JUDGE_BAND_HALF_HEIGHT * 2 * scale)
    const j = band.getContext('2d')
    j.scale(scale, scale); j.translate(0, JUDGE_BAND_HALF_HEIGHT - judgeY)
    if (judgeGradation) j.drawImage(judgeGradation, 0, judgeY - 12, width, 24)
    if (judgeLine) j.drawImage(judgeLine, 0, judgeY - 10, width, 20)
    for (const p of judges) {
      j.beginPath(); j.arc(p.x, p.y, 10, 0, Math.PI * 2); j.strokeStyle = 'rgba(112, 239, 255, .3)'; j.lineWidth = 10; j.stroke()
      j.beginPath(); j.arc(p.x, p.y, 9, 0, Math.PI * 2); j.strokeStyle = '#befaff'; j.lineWidth = 2.5; j.stroke()
    }
    store(TRACK_TEXTURES.judge, band, { mipmap: false })
    onTextureReady()
  }

  function upload(target, data) {
    target.use()
    if (target.capacity < data.byteLength) {
      target.capacity = Math.max(data.byteLength, target.capacity * 2)
      gl.bufferData(gl.ARRAY_BUFFER, target.capacity, gl.DYNAMIC_DRAW)
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data)
  }
  const blend = mode => mode === 'additive' ? gl.blendFunc(gl.ONE, gl.ONE) : gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

  let particleData = new Float32Array(4096)
  // Particle instructions from SongChartHitEffectRenderer: perspective quads, additive over the finished track.
  function drawParticles(instructions, images, stats) {
    const groups = new Map()
    for (const p of instructions) {
      const source = images.get(p.textureId)
      if (!source?.naturalWidth || !p.quad.every(point => point.depth > 0)) continue
      const key = `fx:${p.textureId}`
      if (!textures.get(key)?.ready) store(key, source)
      let group = groups.get(key)
      if (!group) groups.set(key, group = { source, items: [] })
      group.items.push(p)
    }
    let count = 0
    const runs = []
    for (const [key, { source, items }] of groups) {
      const first = count, w = source.naturalWidth, h = source.naturalHeight
      const needed = (count + items.length * 6) * PARTICLE_FLOATS
      if (needed > particleData.length) { const grown = new Float32Array(Math.max(needed, particleData.length * 2)); grown.set(particleData.subarray(0, count * PARTICLE_FLOATS)); particleData = grown }
      for (const { sx, sy, sw, sh, colorTint: tint, alpha, quad } of items) {
        const u = [sx / w, (sx + sw) / w], v = [sy / h, (sy + sh) / h]
        for (const i of [0, 2, 1, 1, 2, 3]) {
          const point = quad[i], o = count++ * PARTICLE_FLOATS
          particleData[o] = point.x; particleData[o + 1] = point.y; particleData[o + 2] = point.depth
          particleData[o + 3] = u[i % 2]; particleData[o + 4] = v[i < 2 ? 0 : 1]
          particleData[o + 5] = tint.r * alpha; particleData[o + 6] = tint.g * alpha; particleData[o + 7] = tint.b * alpha; particleData[o + 8] = alpha
        }
      }
      runs.push({ key, first, count: count - first })
    }
    if (!count) return
    upload(particles, particleData.subarray(0, count * PARTICLE_FLOATS))
    blend('additive')
    for (const { key, first, count: vertices } of runs) {
      gl.bindTexture(gl.TEXTURE_2D, textures.get(key).texture)
      gl.drawArrays(gl.TRIANGLES, first, vertices)
      if (stats) stats.draws++
    }
    if (stats) stats.bytes += count * PARTICLE_FLOATS * 4
  }

  return {
    get lost() { return lost },
    resize(width, height) {
      if (canvas.width === width && canvas.height === height) return false
      canvas.width = width; canvas.height = height
      return true
    },
    draw(frame, scene, { particles: instructions = [], effectImages = new Map(), stats = null } = {}) {
      if (lost) return
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.enable(gl.BLEND)
      paintStatic(scene, canvas.width / scene.width)
      gl.clearColor(22 / 255, 43 / 255, 54 / 255, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      upload(sprites, frame.data)
      for (const run of frame.runs) {
        const object = texture(run.texture)
        if (!object) continue // not decoded yet; redrawn when it is
        gl.bindTexture(gl.TEXTURE_2D, object)
        blend(run.blend)
        gl.drawArrays(gl.TRIANGLES, run.first, run.count)
        if (stats) stats.draws++
      }
      if (stats) stats.bytes += frame.vertexCount * FLOATS_PER_VERTEX * 4
      if (instructions.length) drawParticles(instructions, effectImages, stats)
    },
    dispose() {
      if (lost) return
      for (const { texture: object } of textures.values()) gl.deleteTexture(object)
      for (const target of [sprites, particles]) { gl.deleteBuffer(target.buffer); gl.deleteProgram(target.object) }
    },
  }
}
