<template>
  <div class="spine-viewer-root">
    <!-- PIXI canvas container -->
    <div ref="canvasRef" class="viewer-canvas"></div>

    <!-- Sidebar Control Panel -->
    <div class="control-panel">
      <h2 class="panel-title">Spine 实验室</h2>

      <div class="ctrl-group">
        <label class="ctrl-label">Background</label>
        <select v-model="selectedBg" class="ctrl-select" @change="onBgChange">
          <option value="">(none)</option>
          <option v-for="bg in bgList" :key="bg" :value="bg">{{ bg }}</option>
        </select>
      </div>

      <div class="ctrl-group">
        <label class="ctrl-label">Idol Model</label>
        <select v-model="selectedModel" class="ctrl-select" @change="onModelChange">
          <option value="">(select)</option>
          <option v-for="m in modelList" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>

      <div class="ctrl-group" v-if="animList.length > 0">
        <label class="ctrl-label">Animation</label>
        <select v-model="selectedAnim" class="ctrl-select" @change="onAnimChange">
          <option v-for="a in animList" :key="a" :value="a">{{ a }}</option>
        </select>
      </div>

      <div class="ctrl-group" v-if="faceList.length > 0">
        <label class="ctrl-label">Face</label>
        <div class="face-btns">
          <button
            v-for="f in faceList"
            :key="f"
            class="face-btn"
            :class="{ active: selectedFace === f }"
            @click="onFaceChange(f)"
          >
            {{ f.replace('face_', '') }}
          </button>
        </div>
      </div>

      <div class="ctrl-group">
        <label class="ctrl-label">Scale</label>
        <div class="scale-row">
          <button class="scale-btn" @click="adjustScale(-0.05)">−</button>
          <span class="scale-val">{{ currentScale.toFixed(2) }}</span>
          <button class="scale-btn" @click="adjustScale(0.05)">+</button>
        </div>
      </div>

      <div class="ctrl-info" v-if="statusText">
        {{ statusText }}
      </div>

      <button class="back-btn" @click="$emit('back')">← Back to Home</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, markRaw } from 'vue'
import * as PIXI from 'pixi.js'
import { Spine, SkeletonBinary, AtlasAttachmentLoader } from '@pixi-spine/runtime-3.8'
import { TextureAtlas } from '@pixi-spine/base'
import { getSpineSkelUrl, getSpineAtlasUrl, getSpineFaceUrl, getBgUrl } from '../utils/AssetResolver.js'

const emit = defineEmits(['back'])
const canvasRef = ref(null)

// ── PIXI state ──
let app = null
let bgSprite = null
let currentSpine = null   // { spine, spineData, modelId }
let _currentObjectUrl = null

// ── UI state ──
const bgList = ref([])
const modelList = ref([])
const animList = ref([])
const faceList = ref([])
const selectedBg = ref('')
const selectedModel = ref('')
const selectedAnim = ref('')
const selectedFace = ref('')
const currentScale = ref(0.26)
const statusText = ref('')

// ── Init PIXI ──
onMounted(async () => {
  if (!canvasRef.value) return
  app = markRaw(new PIXI.Application({
    width: canvasRef.value.clientWidth,
    height: canvasRef.value.clientHeight,
    backgroundColor: 0x222222,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  }))
  canvasRef.value.appendChild(app.view)

  await loadLists()
})

onBeforeUnmount(() => {
  destroySpine()
  if (bgSprite) { bgSprite.destroy(true); bgSprite = null }
  if (app) { app.destroy(true); app = null }
  if (_currentObjectUrl) { URL.revokeObjectURL(_currentObjectUrl) }
})

// ── Load asset list ──
async function loadLists() {
  try {
    // BGs: fetch the list from bg index
    const r = await fetch('/bg-list.json')
    if (r.ok) bgList.value = await r.json()
  } catch (_) {
    // fallback: manually list using a known pattern
    bgList.value = []
  }
  // Models: fetch from server directory listing
  try {
    const r = await fetch('/spines-index.json')
    if (r.ok) modelList.value = await r.json()
  } catch (_) {
    modelList.value = []
  }
  statusText.value = `${bgList.value.length} backgrounds, ${modelList.value.length} models`
}

// ── Background ──
async function onBgChange() {
  if (bgSprite) { bgSprite.destroy(true); bgSprite = null }
  if (!selectedBg.value) return
  try {
    const url = getBgUrl(selectedBg.value)
    const tex = await PIXI.Texture.fromURL(url)
    bgSprite = new PIXI.Sprite(tex)
    bgSprite.width = app.screen.width
    bgSprite.height = app.screen.height
    app.stage.addChildAt(bgSprite, 0)
  } catch (err) {
    console.warn('[SpineViewer] bg load failed:', err.message)
  }
}

// ── Model loading ──
async function onModelChange() {
  destroySpine()
  animList.value = []
  faceList.value = []
  selectedAnim.value = ''
  selectedFace.value = ''

  if (!selectedModel.value) return
  const modelId = selectedModel.value

  // Load faces
  await loadFaceList(modelId)

  statusText.value = `Loading ${modelId}...`
  try {
    const [atlasBuf, skelBuffer] = await Promise.all([
      fetch(getSpineAtlasUrl(modelId)).then(r => r.arrayBuffer()),
      fetch(getSpineSkelUrl(modelId)).then(r => r.arrayBuffer()),
    ])

    const atlasText = decodeAtlas(atlasBuf)
    const textureFile = extractTextureFilename(atlasText)
    const textureUrl = getTextureUrl(modelId, textureFile)
    const texture = await loadTexture(textureUrl)

    const textureMap = {}
    textureMap[textureFile] = texture

    const atlas = await new Promise((resolve, reject) => {
      try {
        new TextureAtlas(atlasText,
          (path, cb) => {
            const fileName = path.split('/').pop()
            const tex = textureMap[fileName]
            if (tex && tex.baseTexture) cb(tex.baseTexture)
            else cb(null)
          },
          (result) => { if (result) resolve(result); else reject(new Error('TextureAtlas failed')) }
        )
      } catch (e) { reject(e) }
    })

    for (const page of atlas.pages) page.pma = true

    const cleanSkel = decodeSkel(skelBuffer)
    const attachmentLoader = new AtlasAttachmentLoader(atlas)
    const skeletonBinary = new SkeletonBinary(attachmentLoader)
    const skeletonData = skeletonBinary.readSkeletonData(new Uint8Array(cleanSkel))

    currentScale.value = computeAutoScale(skeletonData)
    const spine = new Spine(skeletonData)
    spine.stateData.defaultMix = 0.2
    spine.x = app.screen.width * 0.5
    spine.y = app.screen.height + 20
    spine.scale.set(currentScale.value)

    app.stage.addChild(spine)
    currentSpine = { spine, spineData: skeletonData, modelId }
    currentScale.value = spine.scale.x

    // Populate animations
    animList.value = skeletonData.animations.map(a => a.name)
    if (animList.value.length > 0) {
      selectedAnim.value = animList.value[0]
      spine.state.setAnimation(0, selectedAnim.value, true)
    }

    statusText.value = `${modelId} — ${animList.value.length} anims, ${faceList.value.length} faces`
  } catch (err) {
    statusText.value = `Failed to load ${modelId}: ${err.message}`
    console.error(err)
  }
}

function computeAutoScale(skeletonData) {
  const h = skeletonData.height
  if (h > 0) {
    const REF_HEIGHT = 3060
    return 0.26 * (REF_HEIGHT / h)
  }
  return 0.26
}

// ── Face list ──
async function loadFaceList(modelId) {
  faceList.value = []
  try {
    const r = await fetch(`/spines/${modelId}/faces/index.json`)
    if (r.ok) {
      const data = await r.json()
      faceList.value = data
    }
  } catch (_) { /* index doesn't exist */ }
  // Fallback: derive from file listing
  if (faceList.value.length === 0) {
    const known = ['face_default', 'face_happy', 'face_joy', 'face_sad', 'face_angry',
      'face_serious', 'face_surprise', 'face_shy', 'face_think', 'face_trouble', 'face_swet']
    faceList.value = known
  }
}

// ── Animation ──
function onAnimChange() {
  if (!currentSpine || !selectedAnim.value) return
  const { spine, spineData } = currentSpine
  // 完全清除所有轨道，不留任何残留
  spine.state.clearTracks()
  // 强制立即过渡到空姿势（mix=0 即无过渡帧）
  spine.state.setEmptyAnimation(0, 0)
  // 设置新动画
  if (selectedAnim.value === 'wait_loop') {
    spine.state.setAnimation(0, 'wait_loop', true)
  } else {
    spine.state.setAnimation(0, selectedAnim.value, false)
    if (spineData.findAnimation('wait_loop')) {
      spine.state.addAnimation(0, 'wait_loop', true, 0)
    }
  }
}

// ── Face ──
function onFaceChange(faceName) {
  selectedFace.value = faceName
  if (!currentSpine || !currentSpine.modelId) return
  const modelId = currentSpine.modelId
  const url = getSpineFaceUrl(modelId, faceName)
  loadTexture(url).then(tex => {
    if (!currentSpine) return
    const { spine } = currentSpine
    const slotNames = ['face', 'faces', 'head', 'Face', 'Faces']
    let targetSlot = null
    for (const name of slotNames) {
      targetSlot = spine.skeleton.findSlot(name)
      if (targetSlot) break
    }
    if (!targetSlot) {
      for (const slot of spine.skeleton.slots) {
        if (slot.data.name.toLowerCase().includes('face')) {
          targetSlot = slot
          break
        }
      }
    }
    if (!targetSlot) return
    const curAttachment = targetSlot.getAttachment()
    if (curAttachment && curAttachment.region) {
      curAttachment.region.texture = tex
    }
  }).catch(() => {})
}

// ── Scale ──
function adjustScale(delta) {
  if (!currentSpine) return
  currentScale.value = Math.max(0.01, Math.min(5, currentScale.value + delta))
  currentSpine.spine.scale.set(currentScale.value)
}

// ── Cleanup ──
function destroySpine() {
  if (currentSpine) {
    if (currentSpine.spine.parent) currentSpine.spine.parent.removeChild(currentSpine.spine)
    currentSpine.spine.destroy({ children: true, textures: true })
    currentSpine = null
  }
}

// ── Texture helpers (mirrors PixiStageManager) ──
function decodeAtlas(buf) {
  const view = new DataView(buf)
  const nameLen = view.getUint32(0, true)
  if (nameLen > 0 && nameLen < 200) {
    const padding = (4 - (4 + nameLen) % 4) % 4
    const headerSize = 4 + nameLen + padding + 4
    const decoder = new TextDecoder('utf-8')
    return decoder.decode(buf.slice(headerSize))
  }
  return new TextDecoder('utf-8').decode(buf)
}

function decodeSkel(buf) {
  const view = new DataView(buf)
  const nameLen = view.getUint32(0, true)
  if (nameLen > 0 && nameLen < 100) {
    let printable = true
    for (let i = 0; i < nameLen; i++) {
      const b = view.getUint8(4 + i)
      if (b < 0x20 || b > 0x7e) { printable = false; break }
    }
    if (printable) {
      const padding = (4 - (4 + nameLen) % 4) % 4
      const headerSize = 4 + nameLen + padding + 4
      return buf.slice(headerSize)
    }
  }
  return buf
}

function extractTextureFilename(atlasText) {
  const firstLine = atlasText.split('\n')[0].trim()
  const pngMatch = firstLine.match(/^([a-zA-Z0-9_\-]+\.(png|jpg))/)
  if (pngMatch) return pngMatch[1]
  // Some atlases start with size line
  const lines = atlasText.split('\n')
  for (const line of lines) {
    const m = line.trim().match(/^([a-zA-Z0-9_\-]+\.(png|jpg))/)
    if (m) return m[1]
  }
  return 'comu.png'
}

function getTextureUrl(modelId, filename) {
  return `${window.location.origin}/assets/spines/${modelId}/${filename}`
}

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const base = new PIXI.BaseTexture(img)
      base.alphaMode = PIXI.ALPHA_MODES.PMA
      resolve(new PIXI.Texture(base))
    }
    img.onerror = () => reject(new Error(`Failed to load ${url}`))
    img.src = url
  })
}
</script>

<style scoped>
.spine-viewer-root {
  position: fixed; inset: 0;
  display: flex;
  background: #1a1a2e;
  color: #e0e0e0;
}
.viewer-canvas {
  flex: 1; height: 100%;
}
.control-panel {
  width: 280px; flex-shrink: 0;
  background: #16213e;
  border-left: 1px solid #2a3a5c;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.panel-title {
  font-size: 1rem;
  color: #88ddff;
  margin: 0 0 4px;
  padding-bottom: 8px;
  border-bottom: 1px solid #2a3a5c;
}
.ctrl-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ctrl-label {
  font-size: 0.7rem;
  color: #8899bb;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.ctrl-select {
  background: #0f3460;
  border: 1px solid #2a4a7c;
  color: #e0e0e0;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  max-height: 200px;
}
.ctrl-select:focus {
  outline: none;
  border-color: #5599ff;
}
.face-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.face-btn {
  background: #0f3460;
  border: 1px solid #2a4a7c;
  color: #c0d0e0;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.12s;
}
.face-btn:hover {
  background: #1a4a80;
  border-color: #4488cc;
}
.face-btn.active {
  background: #4488cc;
  border-color: #66aaff;
  color: #fff;
}
.scale-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.scale-btn {
  width: 32px; height: 32px;
  background: #0f3460;
  border: 1px solid #2a4a7c;
  color: #e0e0e0;
  border-radius: 6px;
  font-size: 1.1rem;
  cursor: pointer;
}
.scale-btn:hover { background: #1a4a80; }
.scale-val {
  min-width: 50px;
  text-align: center;
  font-size: 0.9rem;
  font-family: monospace;
  color: #88ddff;
}
.ctrl-info {
  font-size: 0.75rem;
  color: #7799aa;
  line-height: 1.4;
  padding: 8px;
  background: rgba(0,0,0,0.2);
  border-radius: 6px;
}
.back-btn {
  margin-top: auto;
  background: transparent;
  border: 1px solid #3a5a8c;
  color: #88bbee;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}
.back-btn:hover {
  background: rgba(136,187,238,0.1);
  border-color: #5599dd;
}
</style>
