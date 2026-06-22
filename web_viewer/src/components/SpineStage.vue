<template>
  <div ref="containerRef" class="spine-stage-root"></div>

  <!-- Debug Toggle — always visible, bottom-right corner -->
  <button class="debug-toggle" @click="debugMode = !debugMode" :title="debugMode ? '关闭调试' : '开启调试'">
    {{ debugMode ? '✕' : '⚙' }}
  </button>

  <!-- Debug Dashboard — visible when debugMode is on -->
  <div v-if="debugMode" class="debug-panel">
    <div class="debug-title">Spine Debug</div>

    <div v-for="(state, id) in spineStates" :key="id" class="debug-row">
      <div class="debug-id">{{ id }}</div>
      <div class="debug-coords">
        <label>X <input type="number" step="1" :value="state.x" @input="setProp(id, 'x', $event.target.value)" /></label>
        <label>Y <input type="number" step="1" :value="state.y" @input="setProp(id, 'y', $event.target.value)" /></label>
        <label>S <input type="number" step="0.01" :value="state.scale" @input="setProp(id, 'scale', $event.target.value)" /></label>
      </div>
      <div class="debug-btns">
        <button @click="adjustScale(id, -1)">−1</button>
        <button @click="adjustScale(id, -0.1)">−0.1</button>
        <button @click="adjustScale(id, 0.1)">+0.1</button>
        <button @click="adjustScale(id, 1)">+1</button>
        <button @click="centerSpine(id)">◉ 居中</button>
      </div>
    </div>

    <div class="debug-hint">
      💡 在画面上拖拽 Spine 可移动 · 输入框直接改坐标
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, markRaw, reactive, onUnmounted } from 'vue'
import { PixiStageManager } from '../core/PixiStageManager.js'

const props = defineProps({
  step: { type: Object, default: null },
})

const emit = defineEmits(['ready', 'error'])

const containerRef = ref(null)
let manager = null
const debugMode = ref(false)
const spineStates = reactive({})

onMounted(() => {
  if (!containerRef.value) return
  try {
    manager = markRaw(new PixiStageManager(containerRef.value))
    emit('ready')
  } catch (err) {
    console.error('[SpineStage] Init failed:', err)
    emit('error', err)
  }

  if (props.step?.state) {
    applyState(props.step)
  }
})

onBeforeUnmount(() => {
  if (manager) {
    manager.destroy()
    manager = null
  }
})

// Watch debug mode to refresh panel state
watch(debugMode, (on) => {
  if (!manager) return
  manager.setDebugMode(on)
  if (on) {
    syncStates()
  } else {
    Object.keys(spineStates).forEach(k => delete spineStates[k])
  }
})

// Listen for custom event from PixiStageManager drag
onMounted(() => {
  window.addEventListener('spine-dragged', onSpineDragged)
})
onUnmounted(() => {
  window.removeEventListener('spine-dragged', onSpineDragged)
})

function onSpineDragged(e) {
  if (!debugMode.value) return
  spineStates[e.detail.id] = { x: e.detail.x, y: e.detail.y, scale: e.detail.scale }
}

function syncStates() {
  if (!manager) return
  const states = manager.getSpineStates()
  for (const [id, s] of Object.entries(states)) {
    spineStates[id] = s
  }
}

function setProp(id, prop, val) {
  if (!manager) return
  const n = parseFloat(val)
  if (isNaN(n)) return
  const entry = manager.spineInstances[id]
  if (!entry) return
  if (prop === 'x') entry.spine.x = n
  else if (prop === 'y') entry.spine.y = n
  else if (prop === 'scale') entry.spine.scale.set(n)
  if (spineStates[id]) spineStates[id][prop] = n
}

function adjustScale(id, delta) {
  if (!manager) return
  manager.changeSpineScale(id, delta)
  syncStates()
}

function centerSpine(id) {
  if (!manager) return
  const entry = manager.spineInstances[id]
  if (!entry) return
  entry.spine.x = manager.width / 2
  entry.spine.y = manager.height + 50
  entry.spine.scale.set(0.45)
  syncStates()
}

// Known non-visual chara_ids (no portrait/spine to render)
const NON_VISUAL_IDS = new Set([
  'mob', 'group', '100grp', '06fra', '001jup',
  '201sub', '204sub', '205sub', '206sub', '207sub', '208sub', '209sub',
  '210sub', '211sub', '212sub', '213sub', '214sub', '215sub', '216sub',
  '236sub', '238sub', '240sub', '241sub', '246sub',
])

// Per-character Y offset (pixels added to base Y).
// Characters have different skeleton heights; adjust per class.
// tall = -10 (higher on screen), short = +10 (lower), medium/default = 0
// ── TODO: populate as you inspect characters ──
const CHARA_Y_CLASS = {
  // tall
  // medium (default)
  // short
}
const DEFAULT_Y = 895
const Y_CLASS_OFFSET = { tall: -15, short: 15 }
function getCharaY(charaId) {
  const cls = CHARA_Y_CLASS[charaId]
  return DEFAULT_Y + (Y_CLASS_OFFSET[cls] || 0)
}

watch(() => props.step, (step, oldStep) => {
  if (!manager) return
  // 即使 step 没有 state，也要清理残留 spine（比如回退到 synopsis/title 步骤时）
  if (!step?.state) {
    if (Object.keys(manager.spineInstances).length > 0) {
      manager.clearAllSpines()
      if (debugMode.value) Object.keys(spineStates).forEach(k => delete spineStates[k])
    }
    return
  }
  applyState(step)
})

async function applyState(step) {
  if (!manager || !step?.state) return
  const state = step.state

  // ── Background ──
  if (state.bg) manager.setBackground(state.bg)
  else manager.clearBackground()

  // 从 state.spines 找当前说话者对应的 spine
  const charaId = step.chara_id || ''
  const hasValidChara = !!(charaId && !NON_VISUAL_IDS.has(charaId) && state.spines?.find(s => s.id === charaId && s.model))

  if (!hasValidChara) {
    // 当前说话者无有效立绘 → 清理所有 spine
    if (Object.keys(manager.spineInstances).length > 0) {
      manager.clearAllSpines()
      if (debugMode.value) Object.keys(spineStates).forEach(k => delete spineStates[k])
    }
    return
  }

  const spineState = state.spines.find(s => s.id === charaId)
  const modelId = spineState.model
  const existing = manager.spineInstances[charaId]

  // ── 差分渲染 ──
  if (existing && existing.modelId === modelId) {
    if (spineState.face) manager.updateSpineFace(charaId, spineState.face, spineState)
    if (spineState.anim) manager.playSpineAnim(charaId, spineState.anim, !!step.timeline)
    existing.spine.x = manager.width * 0.5
    existing.spine.y = getCharaY(charaId)
    return
  }

  // ── 模型不一致或没有 → 清空并重新生成 ──
  manager.clearAllSpines()
  if (debugMode.value) Object.keys(spineStates).forEach(k => delete spineStates[k])

  try {
    await manager.spawnSpine(charaId, modelId)
    const entry = manager.spineInstances[charaId]
    if (!entry) return
    entry.spine.x = manager.width * 0.5
    entry.spine.y = getCharaY(charaId)
    if (spineState.face) manager.updateSpineFace(charaId, spineState.face, spineState)
    if (spineState.anim) manager.playSpineAnim(charaId, spineState.anim, !!step.timeline)
    if (debugMode.value) syncStates()
  } catch (err) {
    console.error(`[SpineStage] Failed to spawn ${modelId}:`, err)
  }
}

defineExpose({
  get manager() { return manager },
})
</script>

<style scoped>
.spine-stage-root {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  overflow: hidden;
  z-index: 0;
}
.spine-stage-root :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

/* ── Debug Toggle ── */
.debug-toggle {
  position: absolute;
  bottom: 8px;
  right: 8px;
  z-index: 200;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #88ddff;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}
.debug-toggle:hover {
  background: rgba(0, 0, 0, 0.8);
  color: #aaefff;
}

/* ── Debug Panel ── */
.debug-panel {
  position: absolute;
  top: 50px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  background: rgba(0, 0, 0, 0.85);
  color: #0f0;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  min-width: 420px;
  max-width: 600px;
  border: 1px solid rgba(0, 255, 0, 0.25);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
  pointer-events: auto;
}

.debug-title {
  font-size: 13px;
  font-weight: bold;
  color: #0f0;
  text-align: center;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(0, 255, 0, 0.15);
}

.debug-row {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 4px;
}

.debug-id {
  color: #ff6;
  font-weight: bold;
  margin-bottom: 4px;
}

.debug-coords {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}
.debug-coords label {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #8cf;
  font-size: 11px;
}
.debug-coords input {
  width: 64px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #fff;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 11px;
  font-family: inherit;
}
.debug-coords input:focus {
  outline: none;
  border-color: #0f0;
}

.debug-btns {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.debug-btns button {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #ccc;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 10px;
  font-family: inherit;
  transition: background 0.15s;
}
.debug-btns button:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.debug-hint {
  text-align: center;
  margin-top: 6px;
  font-size: 10px;
  color: #888;
  font-style: italic;
}
</style>
