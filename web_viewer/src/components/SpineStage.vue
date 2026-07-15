<template>
  <div ref="containerRef" class="spine-stage-root"></div>

  <div v-if="sceneIcon" class="scene-icon">
    <img :src="sceneIcon.src" alt="" @error="$event.target.style.display = 'none'" />
  </div>

  <!-- Debug Toggle: visible in player/lab contexts, hidden by embedded scenes. -->
  <button v-if="debugControls" class="debug-toggle" @click="debugMode = !debugMode" :title="debugMode ? '关闭调试' : '开启调试'">
    {{ debugMode ? 'ON' : 'DBG' }}
  </button>

  <!-- Debug Dashboard: visible when debugMode is on -->
  <div v-if="debugControls && debugMode" class="debug-panel">
    <div class="debug-title">Spine Debug <span class="debug-mode">yMode={{ Y_MODE }} ps={{ PIXEL_SCALE }}</span>
      <button class="debug-copy-btn" @click="copyParamURL" title="复制当前参数到剪贴板">复制参数</button>
    </div>

    <div v-for="(state, id) in spineStates" :key="id" class="debug-row">
      <div class="debug-id">{{ id }}</div>
      <div class="debug-coords">
        <label>X <input type="number" step="1" :value="state.x" @input="setProp(id, 'x', $event.target.value)" /></label>
        <label>Y <input type="number" step="1" :value="state.y" @input="setProp(id, 'y', $event.target.value)" /></label>
        <label>S <input type="number" step="0.01" :value="state.scale" @input="setProp(id, 'scale', $event.target.value)" /></label>
      </div>
      <div v-if="state.costumeInfo || state.prefabMeta" class="debug-prefab">
        <span>model {{ state.modelId }}</span>
        <span v-if="state.costumeInfo">idol {{ state.costumeInfo.idol_name || state.costumeInfo.idol_code }}</span>
        <span v-if="state.costumeInfo">costume {{ state.costumeInfo.costume_name || 'unknown' }}</span>
        <span v-if="state.costumeInfo">source table{{ (state.costumeInfo.source_tables || []).join('/') }}</span>
        <span v-if="state.costumeInfo">spine {{ yesNo(state.costumeInfo.spine_exists) }} / prefab {{ yesNo(state.costumeInfo.prefab_meta_exists) }}</span>
        <span>ref {{ state.referenceSource }} {{ fmt(state.referenceY) }}</span>
        <span v-if="state.prefabMeta">prefabY {{ fmt(state.prefabMeta.derived?.prefabPositionY) }}</span>
        <span>baseY {{ fmt(state.computedBaseY) }}</span>
        <span>finalBaseY {{ fmt(state.finalBaseY) }}</span>
      </div>
      <div v-if="state.bounds" class="debug-prefab debug-bounds">
        <span>top {{ fmt(state.bounds.top) }}</span>
        <span>bottom {{ fmt(state.bounds.bottom) }}</span>
        <span>height {{ fmt(state.bounds.height) }}</span>
        <span>root->bottom {{ fmt(state.bounds.rootToBottom) }}</span>
      </div>
      <div class="debug-btns">
        <button @click="adjustScale(id, -1)">-1</button>
        <button @click="adjustScale(id, -0.1)">-0.1</button>
        <button @click="adjustScale(id, 0.1)">+0.1</button>
        <button @click="adjustScale(id, 1)">+1</button>
        <button @click="centerSpine(id)">Center</button>
      </div>
    </div>

    <div class="debug-hint">
      Drag a Spine on the stage to move it. Use the inputs for exact coordinates.
    </div>
  </div>

  <div v-if="debugControls && boundsSnapshot" class="bounds-overlay">
    <div
      v-for="line in boundsSnapshot.lines"
      :key="line.key"
      class="bounds-line"
      :class="`bounds-${line.key}`"
      :style="{ top: `${line.y}px` }"
    >
      <span class="bounds-label">{{ line.label }}</span>
    </div>
    <div class="bounds-panel">
      <div class="bounds-title">{{ boundsSnapshot.idolId }} / {{ boundsSnapshot.modelId }}</div>
      <div>rootY {{ fmt(boundsSnapshot.rootY) }}</div>
      <div>visibleTop {{ fmt(boundsSnapshot.visibleTop) }}</div>
      <div>visibleBottom {{ fmt(boundsSnapshot.visibleBottom) }}</div>
      <div>prefabMapped {{ fmt(boundsSnapshot.prefabMappedY) }}</div>
      <div>dialogueBoxTop {{ fmt(boundsSnapshot.dialogueBoxTop) }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, markRaw, reactive, onUnmounted, computed } from 'vue'
import { PixiStageManager } from '../core/PixiStageManager.js'
import { getBodyTypeUrl, getOtherSettingUrl, getCharaIconUrl } from '../utils/AssetResolver.js'
import { loadCostumePrefabMeta } from '../utils/CostumePrefabMetaStore.js'
import { loadCostumeDictionary } from '../utils/CostumeDictionaryStore.js'
import { getCachedMotionSetting, loadIdolMotionSettings } from '../utils/IdolMotionSettingStore.js'
import { computeVisualRootY as computeVisualRootYUtil, resolveBaseY as resolveBaseYUtil } from '../utils/YPositionResolver.js'
import { applyStepSceneState } from '../core/applyStepSceneState.js'
import {
  buildBoundsSnapshot,
  buildSpineDebugState,
  buildYDiagnosticRow,
  logYDiagnostics,
} from './SpineStageDiagnostics.js'

const props = defineProps({
  step: { type: Object, default: null },
  fallbackBg: { type: String, default: null },
  debugControls: { type: Boolean, default: true },
})

const emit = defineEmits(['ready', 'error'])

const sceneIcon = computed(() => {
  const id = props.step?.state?.image_icon?.display_id || props.step?.state?.image_icon?.id
  if (!id) return null
  return { id, src: getCharaIconUrl(id) }
})

const containerRef = ref(null)
let manager = null
let applyStateToken = 0
let lastScreenEffectsKey = ''
const debugMode = ref(false)
const prefabMetaReady = ref(false)
const motionSettingsReady = ref(false)
const spineStates = reactive({})
const boundsSnapshot = ref(null)
let costumePrefabMeta = {}
let costumeDictionary = {}

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
  } else if (props.step && props.fallbackBg) {
    manager.setBackground(props.fallbackBg)
  }

  void _loadPrefabMeta()
  void _loadCostumeDictionary()
  void _loadMotionSettings()
  installDebugGlobals()
})

onBeforeUnmount(() => {
  if (manager) {
    manager.destroy()
    manager = null
  }
})

function installDebugGlobals() {
  window.__SIDEM_Y_DEBUG__ = LOG_Y_DIAGNOSTICS
  window.dumpY = () => {
    const rows = Object.values(Y_DEBUG_STORE)
    console.table(rows)
    return rows
  }
  window.dumpScene = () => {
    if (!manager) {
      console.warn('No spine manager available yet.')
      return []
    }
    const rows = Object.entries(manager.spineInstances).map(([id, entry]) => {
      const snap = manager.getSpineRuntimeSnapshot(id)
      const diag = Y_DEBUG_STORE[id] || {}
      return {
        idolId: id,
        modelId: entry?.modelId || snap?.modelId || '',
        finalScale: snap?.scale?.current ?? null,
        rootY: snap?.root?.y ?? null,
        visibleTop: snap?.bounds?.top ?? null,
        visibleBottom: snap?.bounds?.bottom ?? null,
        targetY: snap?.positioning?.targetY ?? null,
        referenceY: diag.referenceY ?? null,
        computedBaseY: diag.computedBaseY ?? null,
        finalBaseY: diag.finalBaseY ?? null,
        dialogueBoxTop: getDialogueBoxTop(),
      }
    })
    console.table(rows)
    return rows
  }
  window.dumpBounds = () => {
    if (!manager) {
      console.warn('No spine manager available yet.')
      return []
    }
    const rows = Object.entries(manager.spineInstances).map(([id, entry]) => {
      const snap = manager.getSpineRuntimeSnapshot(id)
      const diag = Y_DEBUG_STORE[id] || {}
      return {
        idolId: id,
        modelId: entry?.modelId || snap?.modelId || '',
        rootY: snap?.root?.y ?? null,
        visibleTop: snap?.bounds?.top ?? null,
        visibleBottom: snap?.bounds?.bottom ?? null,
        prefabY: diag.prefabY ?? snap?.prefabMeta?.prefabPositionY ?? null,
        dialogueBoxTop: getDialogueBoxTop(),
      }
    })
    console.table(rows)
    return rows
  }
  window.dumpEyes = (idolId = '') => {
    if (!manager) return []
    return Object.entries(manager.spineInstances)
      .filter(([id]) => !idolId || id === idolId)
      .map(([id, entry]) => {
        const spine = entry?.spine
        const skeleton = spine?.skeleton
        const slots = skeleton?.data?.slots || []
        const isEyePart = value => /eye|lash|pupil|ball|close|smile/i.test(String(value || ''))
        const attachments = skeleton?.data?.defaultSkin?.getAttachments?.() || []
        return {
          idolId: id,
          modelId: entry?.modelId || '',
          face: spine?._currentFaceAnim || '',
          blink: spine?._blinkCfg || null,
          slots: slots.map((slot, index) => ({
            index,
            name: slot.name,
            defaultAttachment: slot.attachmentName || null,
            currentAttachment: skeleton.slots[index]?.attachment?.name || null,
          })).filter(slot => isEyePart(slot.name)),
          attachments: attachments.map(item => ({
            slot: slots[item.slotIndex]?.name || '',
            name: item.name,
            path: item.attachmentName,
          })).filter(item => isEyePart(item.slot) || isEyePart(item.name)),
        }
      })
  }
  window.dumpStage = () => {
    const data = collectStageDebugData()
    console.log('=== Stage Dump ===')
    console.table(data)
    return data
  }
}

function collectStageDebugData() {
  if (!manager) return null
  const data = {
    width: manager.width,
    height: manager.height,
    bgContainer: null,
    bgSprite: null,
    spineContainer: null,
    silhouettes: [],
    spines: [],
    cameraZoom: null,
  }
  if (manager.bgContainer) {
    data.bgContainer = {
      x: manager.bgContainer.x,
      y: manager.bgContainer.y,
      scale: manager.bgContainer.scale?.x ?? null,
    }
  }
  if (manager.spineContainer) {
    data.spineContainer = {
      x: manager.spineContainer.x,
      y: manager.spineContainer.y,
      scale: manager.spineContainer.scale?.x ?? null,
    }
  }
  const bg = manager.bgSprite || manager.backgroundManager?.bgSprite || manager._bgSprite
  if (bg) {
    data.bgSprite = {
      x: bg.x,
      y: bg.y,
      width: bg.width,
      height: bg.height,
      scaleX: bg.scale?.x ?? null,
      scaleY: bg.scale?.y ?? null,
    }
  }
  data.silhouettes = Object.entries(manager._silhouetteSprites || {}).map(([id, sprite]) => ({
    id,
    x: sprite?.x ?? null,
    y: sprite?.y ?? null,
    scaleX: sprite?.scale?.x ?? null,
    scaleY: sprite?.scale?.y ?? null,
    width: sprite?.width ?? null,
    height: sprite?.height ?? null,
  }))
  data.spines = Object.entries(manager.spineInstances || {}).map(([id, entry]) => {
    const snap = manager.getSpineRuntimeSnapshot?.(id)
    const spine = entry?.spine
    const skeleton = spine?.skeleton
    const slotData = skeleton?.data?.slots || []
    const isEyePart = value => /eye|lash|pupil|ball|close|smile/i.test(String(value || ''))
    const skinAttachments = skeleton?.data?.defaultSkin?.getAttachments?.() || []
    return {
      id,
      modelId: entry?.modelId || snap?.modelId || '',
      x: entry?.spine?.x ?? null,
      y: entry?.spine?.y ?? null,
      scale: entry?.spine?.scale?.x ?? null,
      alpha: entry?.spine?.alpha ?? null,
      face: spine?._currentFaceAnim || '',
      blink: spine?._blinkCfg || null,
      eyeSlots: slotData.map((slot, index) => ({
        name: slot.name,
        defaultAttachment: slot.attachmentName || null,
        currentAttachment: skeleton.slots[index]?.attachment?.name || null,
      })).filter(slot => isEyePart(slot.name)),
      eyeAttachments: skinAttachments.map(item => ({
        slot: slotData[item.slotIndex]?.name || '',
        name: item.name,
        path: item.attachmentName,
      })).filter(item => isEyePart(item.slot) || isEyePart(item.name)),
    }
  })
  if (manager.cameraController) {
    const cc = manager.cameraController
    data.cameraZoom = {
      state: cc._cameraZoom ?? null,
      tweenActive: !!cc._cameraTween,
      bgScale: manager.bgContainer?.scale?.x ?? null,
      spineScale: manager.spineContainer?.scale?.x ?? null,
    }
  }
  return data
}

function publishStageDebugData() {
  if (!containerRef.value) return
  const data = collectStageDebugData()
  if (!data) return
  containerRef.value.dataset.stageDebug = JSON.stringify(data)
}

function scheduleStageDebugPublish() {
  publishStageDebugData()
  requestAnimationFrame(() => publishStageDebugData())
  setTimeout(() => publishStageDebugData(), 350)
}

function getDialogueBoxTop() {
  const h = manager?.height || window.innerHeight || 720
  return Math.round(h * 0.62)
}

/**
 * Build a URL with all current spine debug parameters, copy to clipboard.
 * Collects every URL-controlled parameter, skipping ones at their default.
 */
function buildParamURL() {
  const parts = []
  if (USE_PREFAB_META) parts.push('prefabMeta=1')
  if (LOG_Y_DIAGNOSTICS) parts.push('yDebug=1')
  if (Y_MODE !== 'prefab') parts.push(`yMode=${Y_MODE}`)
  if (PIXEL_SCALE !== 0.75) parts.push(`pixelScale=${PIXEL_SCALE}`)
  if (BASE_ANCHOR !== 780) parts.push(`baseAnchor=${BASE_ANCHOR}`)
  if (ANCHOR_UNITY_Y !== -575) parts.push(`anchorUnityY=${ANCHOR_UNITY_Y}`)

  if (manager) {
    for (const [id, entry] of Object.entries(manager.spineInstances)) {
      if (!entry?.spine) continue
      const x = entry.spine.x
      const y = entry.spine.y
      const s = entry.spine.scale?.x
      if (Number.isFinite(x)) parts.push(`x_${id}=${toParamNum(x)}`)
      if (Number.isFinite(y)) parts.push(`y_${id}=${toParamNum(y)}`)
      if (Number.isFinite(s)) parts.push(`s_${id}=${toParamNum(s)}`)
    }
  }

  const base = window.location.pathname
  return parts.length ? base + '?' + parts.join('&') : base
}

function toParamNum(n) {
  // Keep 4 significant digits, no trailing zeros
  return Number(n.toFixed(4)).toString()
}

function copyParamURL() {
  const url = buildParamURL()
  navigator.clipboard.writeText(url).then(() => {
    // Flash feedback on the button via a temporary toast
    const btn = document.querySelector('.debug-copy-btn')
    if (btn) {
      btn.textContent = 'Copied'
      setTimeout(() => { btn.textContent = '复制参数' }, 1500)
    }
  }).catch(() => {
    // Fallback: select and copy via textarea
    const ta = document.createElement('textarea')
    ta.value = url
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  })
}

function computeVisualRootY(id, baseY, posY = 0) {
  if (!manager) return baseY
  // Negate posY: scenario uses Unity convention (Y+ = up, Y- = down),
  // but web/PixiJS has Y+ = down. So negative posY (down in game) 鈫?larger Y in screen.
  const rootY = computeVisualRootYUtil(baseY, posY, manager.width)
  const entry = manager.spineInstances?.[id]
  const snap = manager.getSpineRuntimeSnapshot(id)
  const prefabY = snap?.prefabMeta?.prefabPositionY ?? snap?.prefabMeta?.derived?.prefabPositionY ?? null
  if (entry) {
    entry.positioning = { targetY: rootY, prefabY, finalRootY: rootY }
  }
  return rootY
}

function positionSpine(id, posX, posY, baseY) {
  if (!manager) return
  const rootY = computeVisualRootY(id, baseY, posY)
  manager.setSpinePositionByGameCoord(id, posX, 0, rootY)
}

function syncBoundsSnapshot(step = props.step) {
  boundsSnapshot.value = buildBoundsSnapshot({
    step,
    manager,
    boundsDebug: BOUNDS_DEBUG,
    yDebugStore: Y_DEBUG_STORE,
    getDialogueBoxTop,
  })
}

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

watch(prefabMetaReady, (ready) => {
  if (!ready || !props.step?.state || !manager) return
  applyState(props.step, { reason: 'prefab-meta-ready' })
})

watch(motionSettingsReady, (ready) => {
  if (!ready || !props.step?.state || !manager) return
  applyState(props.step, { reason: 'motion-settings-ready' })
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
  spineStates[e.detail.id] = buildSpineDebugState({
    id: e.detail.id,
    state: e.detail,
    manager,
    resolveBaseY: resolveBaseYUtil,
    config: {
      usePrefabMeta: USE_PREFAB_META,
      costumePrefabMeta,
      costumeDictionary,
      otherSettingCache: _otherSettingCache,
      modelYOffsetMap: MODEL_Y_OFFSET,
      baseAnchor: BASE_ANCHOR,
      subBaseAnchor: SUB_BASE_ANCHOR,
      anchorUnityY: ANCHOR_UNITY_Y,
      subAnchorUnityY: SUB_ANCHOR_UNITY_Y,
      pixelScale: PIXEL_SCALE,
      subPixelScale: SUB_PIXEL_SCALE,
      subModelRe: SUB_MODEL_RE,
    },
  })
  syncBoundsSnapshot()
}

function syncStates() {
  if (!manager) return
  const states = manager.getSpineStates()
  for (const [id, s] of Object.entries(states)) {
    spineStates[id] = buildSpineDebugState({
      id,
      state: s,
      manager,
      resolveBaseY: resolveBaseYUtil,
      config: {
        usePrefabMeta: USE_PREFAB_META,
        costumePrefabMeta,
        costumeDictionary,
        otherSettingCache: _otherSettingCache,
        modelYOffsetMap: MODEL_Y_OFFSET,
        baseAnchor: BASE_ANCHOR,
        subBaseAnchor: SUB_BASE_ANCHOR,
        anchorUnityY: ANCHOR_UNITY_Y,
        subAnchorUnityY: SUB_ANCHOR_UNITY_Y,
        pixelScale: PIXEL_SCALE,
        subPixelScale: SUB_PIXEL_SCALE,
        subModelRe: SUB_MODEL_RE,
      },
    })
  }
  syncBoundsSnapshot()
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
])

// 鈹€鈹€ Per-character default position from idolothersetting 鈹€鈹€
const _otherSettingCache = {}
const URL_FLAGS = new URLSearchParams(window.location.search)
function readUrlNumber(name, fallback) {
  const raw = URL_FLAGS.get(name)
  if (raw == null || raw === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}
function normalizeSourceMode(raw, fallback = 'prefab') {
  const value = String(raw || '').trim().toLowerCase()
  return value || fallback
}
const SUB_MODEL_RE = /^\d{3}sub_/
// Direct prefabY mapping: devs hand-tuned prefabY to compensate for pose differences.
// Formula: BASE_ANCHOR - (referenceY - ANCHOR_UNITY_Y) * PIXEL_SCALE
//   = conservative -> 024shk(-515, lifted by devs) 鈫?floats UP
//   = negative diff -> 016sei(-745, sunk by devs) 鈫?sinks DOWN
const PIXEL_SCALE = readUrlNumber('pixelScale', 0.75)
const BASE_ANCHOR = readUrlNumber('baseAnchor', 780)
const ANCHOR_UNITY_Y = readUrlNumber('anchorUnityY', -575)  // 011min prefabY
const SUB_PIXEL_SCALE = readUrlNumber('subPixelScale', PIXEL_SCALE)
const SUB_BASE_ANCHOR = readUrlNumber('subBaseAnchor', 750)
const SUB_ANCHOR_UNITY_Y = readUrlNumber('subAnchorUnityY', -510)
const MODEL_Y_OFFSET = {}
const USE_PREFAB_META = URL_FLAGS.get('prefabMeta') !== '0'
const Y_MODE = normalizeSourceMode(URL_FLAGS.get('yMode') || 'prefab', 'prefab')
const BODY_SCALE_ENABLED = URL_FLAGS.get('bodyScale') === '1'
const FIT_MODE = (URL_FLAGS.get('fitMode') || 'fixedScale').toLowerCase()
const ANCHOR_MODE = (URL_FLAGS.get('anchorMode') || 'bottom').toLowerCase()
const VISUAL_HEIGHT_REFERENCE = readUrlNumber('visualRefHeight', 2640)
const VISUAL_HEIGHT_STRENGTH = readUrlNumber('heightStrength', 0.8)
// Per-character overrides from URL (e.g. y_016sei=890&s_024shk=0.23).
// These snapshot each character's final X/Y/Scale after positioning,
// so the copy-params button captures multi-character debug adjustments.
const CHARA_OVERRIDE_RE = /^(x|y|s)_(.+)$/
const CHARA_OVERRIDES = {}
for (const [key, val] of URL_FLAGS.entries()) {
  const m = key.match(CHARA_OVERRIDE_RE)
  if (m) {
    const n = Number(val)
    if (Number.isFinite(n)) {
      if (!CHARA_OVERRIDES[m[2]]) CHARA_OVERRIDES[m[2]] = {}
      CHARA_OVERRIDES[m[2]][m[1]] = n
    }
  }
}
function applyCharaOverrides(manager) {
  for (const [id, overrides] of Object.entries(CHARA_OVERRIDES)) {
    const entry = manager?.spineInstances?.[id]
    if (!entry) continue
    if (Number.isFinite(overrides.x)) entry.spine.x = overrides.x
    if (Number.isFinite(overrides.y)) entry.spine.y = overrides.y
    if (Number.isFinite(overrides.s)) entry.spine.scale.set(overrides.s)
  }
}
const LOG_Y_DIAGNOSTICS = URL_FLAGS.get('yDebug') === '1' || URL_FLAGS.get('debugY') === '1'
const BOUNDS_DEBUG = URL_FLAGS.get('bounds') === '1' || URL_FLAGS.get('debugBounds') === '1'
const Y_DEBUG_STORE = (window.__SIDEM_Y_DIAG__ = window.__SIDEM_Y_DIAG__ || {})
let _bodyTypePromise = null
const _bodyTypeById = {}
let _prefabMetaPromise = null
let _costumeDictionaryPromise = null
let _motionSettingsPromise = null

async function _loadBodyTypes() {
  if (_bodyTypePromise) return _bodyTypePromise
  _bodyTypePromise = fetch(getBodyTypeUrl())
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      for (const row of data?.dataList || []) {
        if (row.idolId) _bodyTypeById[row.idolId] = row.bodyType
      }
    })
    .catch(() => {})
  return _bodyTypePromise
}

async function _loadPrefabMeta() {
  if (_prefabMetaPromise) return _prefabMetaPromise
  _prefabMetaPromise = loadCostumePrefabMeta()
    .then(models => {
      costumePrefabMeta = models || {}
      prefabMetaReady.value = true
      return costumePrefabMeta
    })
    .catch(() => {
      costumePrefabMeta = {}
      prefabMetaReady.value = true
      return costumePrefabMeta
    })
  return _prefabMetaPromise
}

async function _loadCostumeDictionary() {
  if (_costumeDictionaryPromise) return _costumeDictionaryPromise
  _costumeDictionaryPromise = loadCostumeDictionary()
    .then(models => {
      costumeDictionary = models || {}
      if (debugMode.value) syncStates()
      return costumeDictionary
    })
    .catch(() => {
      costumeDictionary = {}
      return costumeDictionary
    })
  return _costumeDictionaryPromise
}

async function _loadMotionSettings() {
  if (_motionSettingsPromise) return _motionSettingsPromise
  _motionSettingsPromise = loadIdolMotionSettings()
    .then(() => {
      motionSettingsReady.value = true
    })
    .catch(() => {
      motionSettingsReady.value = true
    })
  return _motionSettingsPromise
}

function getBodyType(charaId) {
  return _bodyTypeById[charaId] || null
}

function getMotionSetting(charaId, modelId, animName) {
  return getCachedMotionSetting(charaId, modelId, animName)
}

async function _loadOtherSetting(charaId) {
  if (_otherSettingCache[charaId] !== undefined) return
  try {
    const url = getOtherSettingUrl(charaId)
    const res = await fetch(url)
    if (!res.ok) { _otherSettingCache[charaId] = null; return }
    _otherSettingCache[charaId] = await res.json()
  } catch (_) {
    _otherSettingCache[charaId] = null
  }
}

function getSelectedReferenceY(charaId, modelId = '') {
  const prefab = USE_PREFAB_META ? costumePrefabMeta?.[modelId] : null
  const prefabY = prefab?.derived?.prefabPositionY
    ?? prefab?.rect?.localPosition?.y
    ?? prefab?.rect?.anchoredPosition?.y
  const other = _otherSettingCache[charaId]
  const otherY = typeof other?.positionY === 'number' ? other.positionY : null

  const y = typeof prefabY === 'number' ? prefabY : typeof otherY === 'number' ? otherY : null
  const source = typeof prefabY === 'number' ? 'prefab_direct' : typeof otherY === 'number' ? 'idolothersetting' : 'default'

  return { y, source, prefabHit: !!prefab, prefabY: typeof prefabY === 'number' ? prefabY : null, otherY }
}

function resolveBaseY(charaId, modelId = '') {
  const reference = getSelectedReferenceY(charaId, modelId)
  const modelYOffset = MODEL_Y_OFFSET[modelId] || 0
  const baseY = SUB_MODEL_RE.test(modelId) ? SUB_BASE_ANCHOR : BASE_ANCHOR
  const referenceY = typeof reference.y === 'number' ? reference.y : null

  // Uniform prefabY-to-screen mapping: trust the devs' hand-tuned positionY.
  // No pivot/bottom correction needed; prefabY already compensates for pose height.
  let computedBaseY = baseY
  if (Number.isFinite(referenceY)) {
    computedBaseY = SUB_MODEL_RE.test(modelId)
      ? SUB_BASE_ANCHOR - (referenceY - SUB_ANCHOR_UNITY_Y) * SUB_PIXEL_SCALE
      : BASE_ANCHOR - (referenceY - ANCHOR_UNITY_Y) * PIXEL_SCALE
  }

  return {
    reference,
    computedBaseY,
    finalBaseY: computedBaseY + modelYOffset,
  }
}

function fmt(value) {
  return typeof value === 'number' ? Number(value.toFixed(3)).toString() : 'null'
}

function yesNo(value) {
  if (value === true) return 'yes'
  if (value === false) return 'no'
  return 'unknown'
}

watch(() => props.step, (step, oldStep) => {
  if (!manager) return
  applyStateToken++
  // Clear stale stage state when returning to non-story screens.
  if (!step?.state) {
    if (props.fallbackBg) {
      manager.setBackground(props.fallbackBg)
    } else {
      manager.clearBackground()
    }
    manager.setCameraFilter(null)
    manager.clearBgBlur()
    manager.clearBgColorOverlay()
    manager.applyBgEffects?.([])
    manager.clearScreenSlide?.()
    if (Object.keys(manager.spineInstances).length > 0) {
      manager.clearAllSpines()
      if (debugMode.value) Object.keys(spineStates).forEach(k => delete spineStates[k])
    }
    boundsSnapshot.value = null
    return
  }
  applyState(step)
})

watch(() => props.fallbackBg, () => {
  if (!manager || props.step?.state?.bg) return
  if (props.fallbackBg) manager.setBackground(props.fallbackBg)
  else manager.clearBackground()
})

async function applyState(step) {
  if (!manager || !step?.state) return
  const token = ++applyStateToken
  const state = step.state
  await _loadBodyTypes()
  if (token !== applyStateToken || !manager) return

  lastScreenEffectsKey = applyStepSceneState({
    manager,
    step,
    state,
    fallbackBg: props.fallbackBg,
    lastScreenEffectsKey,
  })

  const charaId = step.chara_id || ''
  const desired = state.spines || []
  const existingIds = new Set(Object.keys(manager.spineInstances))
  for (const sid of Object.keys(manager._silhouetteSprites || {})) {
    existingIds.add(sid)
  }
  for (const sid of Object.keys(manager._silhouettePending || {})) {
    existingIds.add(sid)
  }
  const desiredIds = new Set()
  const desiredOrder = []
  let hasOfficialPriority = false
  // 鈹€鈹€ Phase 1: Process all desired spines 鈹€鈹€
  for (const spineState of desired) {
    const sid = spineState.id
    if (!sid || NON_VISUAL_IDS.has(sid) || !spineState.model) continue
    desiredIds.add(sid)
    desiredOrder.push(spineState)
    if (spineState.idol_priority != null) hasOfficialPriority = true

    // Load the per-character baseline before positioning. Without awaiting
    // this, first render uses the rough fallback and later navigation differs.
    if (_otherSettingCache[sid] === undefined) await _loadOtherSetting(sid)
    if (token !== applyStateToken || !manager) return

    const modelId = spineState.model
    const existing = manager.spineInstances[sid]
    const reference = getSelectedReferenceY(sid, modelId)
    const resolved = resolveBaseYUtil({
      charaId: sid,
      modelId,
      usePrefabMeta: USE_PREFAB_META,
      costumePrefabMeta,
      otherSettingCache: _otherSettingCache,
      modelYOffsetMap: MODEL_Y_OFFSET,
      baseAnchor: BASE_ANCHOR,
      subBaseAnchor: SUB_BASE_ANCHOR,
      anchorUnityY: ANCHOR_UNITY_Y,
      subAnchorUnityY: SUB_ANCHOR_UNITY_Y,
      pixelScale: PIXEL_SCALE,
      subPixelScale: SUB_PIXEL_SCALE,
      subModelRe: SUB_MODEL_RE,
    })
    const prefabMeta = costumePrefabMeta?.[modelId] || null
    logYDiagnostics({
      row: buildYDiagnosticRow({
        charaId: sid,
        modelId,
        reference,
        manager,
        resolveBaseY: resolveBaseYUtil,
        config: {
          usePrefabMeta: USE_PREFAB_META,
          costumePrefabMeta,
          costumeDictionary,
          otherSettingCache: _otherSettingCache,
          modelYOffsetMap: MODEL_Y_OFFSET,
          baseAnchor: BASE_ANCHOR,
          subBaseAnchor: SUB_BASE_ANCHOR,
          anchorUnityY: ANCHOR_UNITY_Y,
          subAnchorUnityY: SUB_ANCHOR_UNITY_Y,
          pixelScale: PIXEL_SCALE,
          subPixelScale: SUB_PIXEL_SCALE,
          subModelRe: SUB_MODEL_RE,
        },
      }),
      enabled: LOG_Y_DIAGNOSTICS,
      debugMode: debugMode.value,
      store: Y_DEBUG_STORE,
    })

    if (manager.hasSilhouetteFallback?.(sid, modelId)) {
      const posX = spineState.pos_x ?? 0
      let posY = spineState.pos_y ?? 0
      if (spineState.idol_zoom_y_offset) posY += spineState.idol_zoom_y_offset
      const rootY = computeVisualRootY(sid, resolved.finalBaseY, posY)
      manager.showSilhouette(sid, modelId, posX, 0, rootY)
      continue
    }

    if (existing && existing.modelId === modelId) {
      existing.prefabMeta = prefabMeta
      // Same model: update face/anim and reposition.
      if (spineState.face) manager.updateSpineFace(sid, spineState.face, spineState)
      if (spineState.anim) manager.playSpineAnim(sid, spineState.anim, !!step.timeline, !!spineState.anim_no_back, getMotionSetting(sid, modelId, spineState.anim))
      if (spineState.neck_anim_stop) manager.stopSpineNeckAnim?.(sid)
      else if (spineState.neck_anim) manager.playSpineNeckAnim?.(sid, spineState.neck_anim)
      manager.setSpinePartsVisible?.(sid, spineState.parts_visible !== false)
      manager.flushSpinePose?.(sid, 0)
      const posX = spineState.pos_x ?? 0
      let posY = spineState.pos_y ?? 0
      // Zoom-based Y compensation: when idol_zoom shrinks the character,
      // the root-anchored scaling pulls visual center downward. Raise the
      // character proportionally to counteract the sinking.
      if (spineState.idol_zoom_y_offset) posY += spineState.idol_zoom_y_offset
      const fit = FIT_MODE === 'prefabrect' && prefabMeta
        ? manager.fitSpineToPrefabRect(existing.spine, prefabMeta, { anchorMode: ANCHOR_MODE })
        : null
      const baseY = fit?.rootY ?? resolved.finalBaseY
      const targetY = computeVisualRootYUtil(baseY, posY, manager.width)
      // Slide animation: use animateSpinePosition if slide_duration present
      if (spineState.slide_duration && spineState.slide_duration > 0) {
        const targetX = manager.width / 2 + posX * (manager.width / 1280)
        manager.animateSpinePosition(sid, targetX, targetY, spineState.slide_duration)
      } else {
        manager.setSpineZoom(sid, spineState.idol_zoom)
        positionSpine(sid, posX, posY, baseY)
      }
      const colorTransition = spineState.idol_color_transition || {}
      manager.setSpineColor(
        sid,
        spineState.idol_color || null,
        colorTransition.duration ?? 0,
        colorTransition.delay ?? 0,
      )
      if (spineState.fade?.type) {
        const targetAlpha = spineState.fade.type === 'out' ? 0 : 1
        manager.animateSpineAlpha?.(sid, targetAlpha, spineState.fade.duration, spineState.fade.delay)
      } else {
        manager.setSpineAlpha?.(sid, 1)
      }
    } else {
      // Different model or new model: remove old, then spawn new.
      if (existing) manager.removeSpine(sid, true)
      try {
        await manager.spawnSpine(sid, modelId, {
          bodyType: getBodyType(sid),
          prefabMeta,
          bodyScaleEnabled: BODY_SCALE_ENABLED,
          fitMode: FIT_MODE,
          visualHeightReference: VISUAL_HEIGHT_REFERENCE,
          visualHeightStrength: VISUAL_HEIGHT_STRENGTH,
          fadeInDuration: spineState.fade?.type === 'in' ? spineState.fade.duration : undefined,
        })
        if (token !== applyStateToken || !manager) {
          manager?.removeSpine(sid, true)
          return
        }
        const entry = manager.spineInstances[sid]
        if (!entry) {
          // Spine asset not found — try silhouette fallback
          const pX = spineState.pos_x ?? 0
          let pY = spineState.pos_y ?? 0
          if (spineState.idol_zoom_y_offset) pY += spineState.idol_zoom_y_offset
          const rootY = computeVisualRootY(sid, resolved.finalBaseY, pY)
          manager.showSilhouette(sid, modelId, pX, 0, rootY)
          continue
        }
        entry.prefabMeta = prefabMeta
        const posX = spineState.pos_x ?? 0
        let posY = spineState.pos_y ?? 0
        if (spineState.idol_zoom_y_offset) posY += spineState.idol_zoom_y_offset
        if (spineState.face) manager.updateSpineFace(sid, spineState.face, spineState)
        if (spineState.anim) manager.playSpineAnim(sid, spineState.anim, !!step.timeline, !!spineState.anim_no_back, getMotionSetting(sid, modelId, spineState.anim))
        if (spineState.neck_anim_stop) manager.stopSpineNeckAnim?.(sid)
        else if (spineState.neck_anim) manager.playSpineNeckAnim?.(sid, spineState.neck_anim)
        manager.setSpinePartsVisible?.(sid, spineState.parts_visible !== false)
        manager.flushSpinePose?.(sid, 0)
        const fit = FIT_MODE === 'prefabrect' && prefabMeta
          ? manager.fitSpineToPrefabRect(entry.spine, prefabMeta, { anchorMode: ANCHOR_MODE })
          : null
        const baseY = fit?.rootY ?? resolved.finalBaseY
        const colorTransition = spineState.idol_color_transition || {}
        manager.setSpineColor(
          sid,
          spineState.idol_color || null,
          colorTransition.duration ?? 0,
          colorTransition.delay ?? 0,
        )
        manager.setSpineZoom(sid, spineState.idol_zoom)
        positionSpine(sid, posX, posY, baseY)
        if (spineState.fade?.type) {
          const targetAlpha = spineState.fade.type === 'out' ? 0 : 1
          manager.animateSpineAlpha?.(sid, targetAlpha, spineState.fade.duration, spineState.fade.delay)
        } else {
          manager.setSpineAlpha?.(sid, 1)
        }
      } catch (err) {
        console.error(`[SpineStage] Failed to spawn ${modelId}:`, err)
      }
    }
  }

  // 鈹€鈹€ Phase 2: Remove spines no longer in scene 鈹€鈹€
  for (const sid of existingIds) {
    if (!desiredIds.has(sid)) {
      manager.removeSpine(sid, true)
    }
  }

  // 鈹€鈹€ Phase 3: Official z-order, fallback to current speaker front 鈹€鈹€
  if (hasOfficialPriority) {
    const orderedIds = desiredOrder
      .slice()
      .sort((a, b) => {
        const pa = Number.isFinite(Number(a.idol_priority)) ? Number(a.idol_priority) : 0
        const pb = Number.isFinite(Number(b.idol_priority)) ? Number(b.idol_priority) : 0
        if (pa !== pb) return pa - pb
        return desiredOrder.indexOf(a) - desiredOrder.indexOf(b)
      })
      .map(s => s.id)
    manager.applySpineOrder?.(orderedIds)
  } else if (charaId && desiredIds.has(charaId)) {
    manager.bringToFront(charaId)
  }

  // 鈹€鈹€ Apply per-character URL overrides after all positioning logic 鈹€鈹€
  applyCharaOverrides(manager)

  syncBoundsSnapshot(step)
  if (debugMode.value) syncStates()
  scheduleStageDebugPublish()
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

/* 鈹€鈹€ Debug Toggle 鈹€鈹€ */
.scene-icon {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 45;
  width: clamp(48px, 7vw, 76px);
  height: clamp(48px, 7vw, 76px);
  border: 2px solid rgba(255, 255, 255, 0.86);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.22);
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.32);
  pointer-events: none;
}

.scene-icon img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.debug-toggle {
  position: absolute;
  bottom: 8px;
  right: 8px;
  z-index: 300;
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

/* 鈹€鈹€ Debug Panel 鈹€鈹€ */
.debug-panel {
  position: absolute;
  top: 50px;
  left: 12px;
  right: 12px;
  transform: none;
  z-index: 200;
  background: rgba(0, 0, 0, 0.85);
  color: #0f0;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  padding: 10px 12px;
  border-radius: 10px;
  width: auto;
  max-width: none;
  max-height: calc(100vh - 64px);
  overflow: auto;
  border: 1px solid rgba(0, 255, 0, 0.25);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
  pointer-events: auto;
}

.debug-title {
  font-size: 12px;
  font-weight: bold;
  color: #0f0;
  text-align: center;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(0, 255, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.debug-copy-btn {
  font-size: 11px;
  padding: 2px 6px;
  border: 1px solid rgba(0, 255, 0, 0.4);
  background: rgba(0, 255, 0, 0.08);
  color: #0f0;
  cursor: pointer;
  border-radius: 3px;
  white-space: nowrap;
}
.debug-copy-btn:hover {
  background: rgba(0, 255, 0, 0.2);
}

.debug-mode {
  color: #9df;
  font-weight: normal;
  margin-left: 6px;
}

.debug-row {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  padding: 7px 10px 8px;
  margin-bottom: 6px;
  display: grid;
  grid-template-columns: 76px minmax(190px, 240px) minmax(0, 1.25fr) minmax(0, 1.55fr) minmax(180px, 1fr);
  gap: 6px 10px;
  align-items: start;
}

.debug-id {
  color: #ff6;
  font-weight: bold;
  margin-top: 2px;
}

.debug-coords {
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  margin-bottom: 0;
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

.debug-prefab {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  gap: 4px 10px;
  color: #b8f6ff;
  font-size: 10px;
  line-height: 1.3;
  margin: 4px 0 6px;
}

.debug-prefab span {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.debug-btns {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
  justify-content: flex-end;
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
  margin-top: 8px;
  font-size: 10px;
  color: #888;
  font-style: italic;
}

@media (max-width: 960px) {
  .debug-panel {
    left: 6px;
    right: 6px;
    top: 44px;
    max-height: calc(100vh - 54px);
    padding: 8px 10px;
  }
  .debug-row {
    grid-template-columns: 72px minmax(0, 1fr);
  }
  .debug-prefab {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .debug-coords {
    flex-wrap: wrap;
  }
  .debug-btns {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
}

.bounds-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 210;
}

.bounds-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  border-top: 1px dashed rgba(255, 255, 255, 0.55);
}

.bounds-label {
  position: absolute;
  left: 8px;
  top: -9px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  font-size: 10px;
  line-height: 1.2;
}

.bounds-root {
  border-top-color: rgba(255, 90, 90, 0.9);
}

.bounds-top {
  border-top-color: rgba(90, 170, 255, 0.95);
}

.bounds-bottom {
  border-top-color: rgba(90, 255, 120, 0.95);
}

.bounds-prefab {
  border-top-color: rgba(180, 110, 255, 0.95);
}

.bounds-prefabTarget {
  border-top-color: rgba(255, 160, 60, 0.95);
}

.bounds-dialogue {
  border-top-color: rgba(255, 210, 90, 0.95);
}

.bounds-panel {
  position: absolute;
  top: 8px;
  left: 8px;
  min-width: 240px;
  background: rgba(0, 0, 0, 0.72);
  color: #dff;
  font-size: 11px;
  line-height: 1.35;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
}

.bounds-title {
  color: #fff;
  font-weight: 700;
  margin-bottom: 4px;
}
</style>
