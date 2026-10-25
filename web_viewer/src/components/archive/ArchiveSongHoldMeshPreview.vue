<template>
  <canvas ref="canvas" width="1280" height="720" aria-hidden="true" data-native-hold-canvas :data-hold-count="holds.length" :data-flick-count="holds.filter(h => h.flickConnector).length" :data-vertex-count="vertexCount" @webglcontextlost.prevent="emit('unavailable')" />
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import nativeHolds from '../../../config/song-track-native-hold-geometry.v1.json'

const props = defineProps({ holds: { type: Array, required: true }, skin: { type: String, required: true } })
const emit = defineEmits(['unavailable'])
const canvas = ref(null)
const vertexCount = computed(() => props.holds.reduce((sum, hold) => sum + hold.nativeMesh.vertices.length, 0))
let gl, program, vertices, indices, texture, disposed = false, loadedSkin = null
const images = new Map()
const shaders = []

function shader(type, source) {
  const object = gl.createShader(type)
  shaders.push(object)
  gl.shaderSource(object, source)
  gl.compileShader(object)
  if (!gl.getShaderParameter(object, gl.COMPILE_STATUS)) throw new Error('Hold shader compilation failed')
  return object
}
function draw() {
  if (!gl || disposed) return
  gl.clear(gl.COLOR_BUFFER_BIT)
  if (loadedSkin !== props.skin) return
  gl.useProgram(program)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices)
  for (const hold of props.holds) {
    const mesh = hold.nativeMesh
    const data = new Float32Array(mesh.vertices.length * 4)
    for (let i = 0; i < mesh.vertices.length; i++) {
      const offset = i * 4
      data[offset] = mesh.vertices[i].x
      data[offset + 1] = mesh.vertices[i].y
      data[offset + 2] = mesh.uv[i][0]
      data[offset + 3] = mesh.uv[i][1]
    }
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.triangles), gl.DYNAMIC_DRAW)
    gl.drawElements(gl.TRIANGLES, mesh.triangles.length, gl.UNSIGNED_SHORT, 0)
  }
}
async function loadSkin() {
  if (!gl || disposed) return
  const skin = props.skin
  try {
    if (!images.has(skin)) images.set(skin, new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = nativeHolds.skins[skin].url
    }))
    const image = await images.get(skin)
    if (disposed || skin !== props.skin) return
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    loadedSkin = skin
    draw()
  } catch { if (!disposed) emit('unavailable') }
}
onMounted(() => {
  try {
    gl = canvas.value.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true })
    if (!gl) throw new Error('WebGL unavailable')
    program = gl.createProgram()
    gl.attachShader(program, shader(gl.VERTEX_SHADER, 'attribute vec2 position; attribute vec2 uv; varying vec2 textureUV; void main(){ gl_Position=vec4(position/vec2(640.0,360.0),0.0,1.0); textureUV=uv; }'))
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, 'precision mediump float; varying vec2 textureUV; uniform sampler2D image; void main(){ gl_FragColor=texture2D(image,textureUV); }'))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Hold program linking failed')
    gl.useProgram(program)
    vertices = gl.createBuffer()
    indices = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices)
    for (const [name, offset] of [['position', 0], ['uv', 8]]) {
      const attribute = gl.getAttribLocation(program, name)
      gl.enableVertexAttribArray(attribute)
      gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 16, offset)
    }
    texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.clearColor(0, 0, 0, 0)
    gl.viewport(0, 0, 1280, 720)
    loadSkin()
  } catch { emit('unavailable') }
})
watch(() => props.holds, draw)
watch(() => props.skin, loadSkin)
onBeforeUnmount(() => {
  disposed = true
  if (!gl) return
  gl.deleteBuffer(vertices)
  gl.deleteBuffer(indices)
  gl.deleteTexture(texture)
  gl.deleteProgram(program)
  for (const shader of shaders) gl.deleteShader(shader)
})
</script>

<style scoped>
canvas { display: block; width: 1280px; height: 720px; pointer-events: none; }
</style>
