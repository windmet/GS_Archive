<template>
  <div
    ref="viewportRef"
    class="spine-stage-root"
    :data-presentation-suspended="suspended"
    :data-background-owner="manageBackground ? 'standalone' : 'external'"
  >
    <div ref="containerRef" class="spine-stage-canvas" :style="frameStyle"></div>
  </div>

  <!-- Debug Toggle: visible in player/lab contexts, hidden by embedded scenes. -->
  <button v-if="debugControls" class="debug-toggle" @click="debugMode = !debugMode" :title="debugMode ? '关闭调试' : '开启调试'">
    {{ debugMode ? 'ON' : 'DBG' }}
  </button>

  <!-- Debug Dashboard: visible when debugMode is on -->
  <div v-if="debugControls && debugMode" class="debug-panel">
    <div class="debug-title">Spine Debug <span class="debug-mode">native ADV placement</span></div>

    <div v-for="(state, id) in spineStates" :key="id" class="debug-row">
      <div class="debug-id">{{ id }}</div>
      <div class="debug-coords">
        <label>X <input type="number" step="1" :value="state.x" @input="setProp(id, 'x', $event.target.value)" /></label>
        <label>Y <input type="number" step="1" :value="state.y" @input="setProp(id, 'y', $event.target.value)" /></label>
        <label>S <input type="number" step="0.01" :value="state.scale" @input="setProp(id, 'scale', $event.target.value)" /></label>
      </div>
      <div class="debug-prefab">
        <span>model {{ state.modelId }}</span>
        <span v-if="state.costumeInfo">idol {{ state.costumeInfo.idol_name || state.costumeInfo.idol_code }}</span>
        <span v-if="state.costumeInfo">costume {{ state.costumeInfo.costume_name || 'unknown' }}</span>
        <span>prefabY {{ fmt(state.figure?.prefabY) }}</span>
        <span v-if="state.adv">pos {{ fmt(state.adv.posX) }}, {{ fmt(state.adv.posY) }}</span>
        <span v-if="state.adv">zoom {{ fmt(state.adv.zoom) }} @ {{ fmt(state.adv.zoomX) }}, {{ fmt(state.adv.zoomY) }}</span>
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
      <div>prefabY {{ fmt(boundsSnapshot.prefabY) }}</div>
      <div>dialogueBoxTop {{ fmt(boundsSnapshot.dialogueBoxTop) }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, markRaw, reactive, onUnmounted, computed } from 'vue'
import { tracePlayer } from '../core/PlayerTrace.js'
import { storyStageFrame } from '../core/StoryStageFraming.js'
import { PixiStageManager } from '../core/PixiStageManager.js'
import { storySpineOrder } from '../core/StorySpineOrder.js'
import { isSilhouetteOnlyModel } from '../utils/AssetResolver.js'
import { loadFigurePlacement } from '../utils/FigurePlacementStore.js'
import { loadCostumeDictionary } from '../utils/CostumeDictionaryStore.js'
import { getCachedMotionSetting, getCachedMotionTable, loadIdolMotionSettings } from '../utils/IdolMotionSettingStore.js'
import { applyStepSceneState } from '../core/applyStepSceneState.js'
import { getStepSceneState } from '../core/story-runtime/StepSceneState.js'
import { storyReleaseProbe } from '../core/story-runtime/StoryReleaseProbe.js'
import { buildBoundsSnapshot, buildSpineDebugState } from './SpineStageDiagnostics.js'

const props = defineProps({
  suspended: { type: Boolean, default: false },
  step: { type: Object, default: null },
  fallbackBg: { type: String, default: null },
  manageBackground: { type: Boolean, default: false },
  debugControls: { type: Boolean, default: false },
  releaseOwner: { type: String, default: '' },
  portraitFraming: { type: Boolean, default: false },
  nowMilliseconds: { type: Function, default: undefined },
})

const emit = defineEmits(['ready', 'scene-ready', 'error'])

const viewportRef = ref(null)
const containerRef = ref(null)
const frameStyle = ref({ width: '100%', height: '100%' })
let framingObserver = null
let presentationScale = 1
function updateFraming() {
  if (!props.portraitFraming || !viewportRef.value || !containerRef.value) return
  // clientWidth/Height round to whole pixels, so at fractional browser zoom the
  // scaled canvas could end up a sliver short of the viewport and expose the page
  // behind it. Size from the fractional box rounded up; the root clips the excess.
  const box = viewportRef.value.getBoundingClientRect()
  const frame = storyStageFrame(Math.ceil(box.width), Math.ceil(box.height))
  if (!frame) return
  const style = { width: `${frame.width}px`, height: `${frame.height}px`, transform: `scale(${frame.scale})`, transformOrigin: 'top left' }
  presentationScale = frame.scale
  manager?.setPresentationScale(frame.scale)
  frameStyle.value = style
  // Set the initial reference dimensions before Pixi reads clientWidth/Height.
  Object.assign(containerRef.value.style, style)
}
let manager = null
let unregisterReleaseStage = null
let applyStateToken = 0
let applyStateLoad = new AbortController()
let projectedStep = null
let projectionFailure = null
const stageMetadataOwner = new AbortController()
let lastScreenEffectsKey = ''
let managedBackgroundId = null
const debugMode = ref(false)
const spineStates = reactive({})
const boundsSnapshot = ref(null)
let figurePlacement = null
let costumeDictionary = {}

onMounted(() => {
  if (!containerRef.value) return
  try {
    updateFraming()
    if (props.portraitFraming) {
      framingObserver = new ResizeObserver(updateFraming)
      framingObserver.observe(viewportRef.value)
    }
    manager = markRaw(new PixiStageManager(containerRef.value, { presentationScale }))
    manager.setPresentationSuspended(props.suspended)
    if (props.releaseOwner === 'story-player') {
      unregisterReleaseStage = storyReleaseProbe.registerStageManager(manager)
    }
    emit('ready')
  } catch (err) {
    console.error('[SpineStage] Init failed:', err)
    emit('error', err)
  }

  syncManagedBackground()
  if (getStepSceneState(props.step)) {
    applyState(props.step)
  } else if (!props.manageBackground && props.step && props.fallbackBg) {
    manager.setBackground(props.fallbackBg)
  }

  // Costume names are diagnostics only; empty-background entries need no actor metadata.
  if (props.debugControls) void _loadCostumeDictionary()
  installDebugGlobals()
})

function syncManagedBackground() {
  if (!manager || !props.manageBackground) return
  const backgroundId = getStepSceneState(props.step)?.bg || props.fallbackBg || null
  if (backgroundId === managedBackgroundId) return
  managedBackgroundId = backgroundId
  if (backgroundId) manager.setBackground(backgroundId)
  else manager.clearBackground()
}

onBeforeUnmount(() => {
  applyStateLoad.abort()
  stageMetadataOwner.abort()
  framingObserver?.disconnect()
  if (manager) {
    manager.destroy()
    manager = null
  }
  unregisterReleaseStage?.()
  unregisterReleaseStage = null
})

function installDebugGlobals() {
  window.dumpScene = () => {
    if (!manager) {
      console.warn('No spine manager available yet.')
      return []
    }
    const rows = Object.entries(manager.spineInstances).map(([id, entry]) => {
      const snap = manager.getSpineRuntimeSnapshot(id)
      return {
        idolId: id,
        modelId: entry?.modelId || snap?.modelId || '',
        finalScale: snap?.scale?.current ?? null,
        rootY: snap?.root?.y ?? null,
        visibleTop: snap?.bounds?.top ?? null,
        visibleBottom: snap?.bounds?.bottom ?? null,
        prefabY: snap?.placement?.figure?.prefabY ?? null,
        adv: snap?.placement?.adv ?? null,
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
      return {
        idolId: id,
        modelId: entry?.modelId || snap?.modelId || '',
        rootY: snap?.root?.y ?? null,
        visibleTop: snap?.bounds?.top ?? null,
        visibleBottom: snap?.bounds?.bottom ?? null,
        prefabY: snap?.placement?.figure?.prefabY ?? null,
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
  data.silhouettes = Object.entries(manager._silhouetteSprites || {}).map(([id, record]) => [id, record?.sprite]).map(([id, sprite]) => ({
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
    const poseBones = Object.fromEntries(
      ['root', 'chara_MIX', 'body', 'neck', 'head', 'face_control'].map(name => {
        const bone = skeleton?.findBone?.(name)
        return [name, bone ? {
          x: bone.x,
          y: bone.y,
          rotation: bone.rotation,
          worldX: bone.worldX,
          worldY: bone.worldY,
        } : null]
      }),
    )
    const isEyePart = value => /eye|lash|pupil|ball|close|smile/i.test(String(value || ''))
    const skinAttachments = skeleton?.data?.defaultSkin?.getAttachments?.() || []
    return {
      id,
      modelId: entry?.modelId || snap?.modelId || '',
      x: entry?.spine?.x ?? null,
      y: entry?.spine?.y ?? null,
      scale: entry?.spine?.scale?.x ?? null,
      alpha: entry?.spine?.alpha ?? null,
      body: spine?._currentBodyAnim || '',
      neck: spine?._currentNeckAnim || '',
      lastNeckEventKey: spine?._lastNeckEventKey || '',
      tracks: snap?.tracks || [],
      poseBones,
      face: spine?._currentFaceAnim || '',
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

function syncBoundsSnapshot(step = props.step) {
  boundsSnapshot.value = buildBoundsSnapshot({
    step,
    manager,
    boundsDebug: BOUNDS_DEBUG,
    getDialogueBoxTop,
  })
}

// Watch debug mode to refresh panel state
watch(debugMode, (on) => {
  if (!manager) return
  manager.setDebugMode(on)
  publishStageDebugData()
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
  spineStates[e.detail.id] = buildSpineDebugState({ id: e.detail.id, state: e.detail, manager, costumeDictionary })
  syncBoundsSnapshot()
}
function syncStates() {
  if (!manager) return
  const states = manager.getSpineStates()
  for (const [id, s] of Object.entries(states)) {
    spineStates[id] = buildSpineDebugState({ id, state: s, manager, costumeDictionary })
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
  manager.placeActor(id, {})
  syncStates()
}

// Known non-visual chara_ids (no portrait/spine to render)
const NON_VISUAL_IDS = new Set([
  'mob', 'group', '100grp', '06fra', '001jup',
])

const URL_FLAGS = new URLSearchParams(window.location.search)
const BOUNDS_DEBUG = URL_FLAGS.get('bounds') === '1' || URL_FLAGS.get('debugBounds') === '1'
async function _loadFigurePlacement(signal) {
  figurePlacement = await loadFigurePlacement({ signal })
  signal?.throwIfAborted()
}
async function _loadCostumeDictionary() {
  try {
    const data = await loadCostumeDictionary({ signal: stageMetadataOwner.signal })
    if (stageMetadataOwner.signal.aborted) return
    costumeDictionary = data
    if (debugMode.value) syncStates()
  } catch (error) {
    if (!stageMetadataOwner.signal.aborted) console.debug('[Stage] Optional costume names unavailable:', error.message)
  }
}
function _loadMotionSettings(signal) { return loadIdolMotionSettings({ signal }) }

function getMotionSetting(charaId, modelId, animName) {
  return getCachedMotionSetting(charaId, modelId, animName)
}

// Client IdolCharacter.CoPlayAnimation: an animation entry with a body motion and no
// neck motion at the same time resets the neck (ResetNeck) before the motion plays.
function applyStateBodyMotion(manager, sid, modelId, spineState, step) {
  if (!spineState.anim) return
  const started = manager.playSpineAnim(sid, spineState.anim, false, !!spineState.anim_no_back,
    getMotionSetting(sid, modelId, spineState.anim), false, null, getCachedMotionTable(sid, modelId), spineState.anim_track_time ?? 0)
  if (started && !spineState.neck_anim && !spineState.neck_anim_stop) {
    manager.stopSpineNeckAnim?.(sid, `state:${step.step_id}:motion-neck-reset:${sid}`)
  }
}

function fmt(value) {
  return typeof value === 'number' ? Number(value.toFixed(3)).toString() : 'null'
}

watch(() => props.suspended, value => manager?.setPresentationSuspended(value))

watch(() => props.step, (step, oldStep) => {
  if (!manager) return
  syncManagedBackground()
  applyStateToken++
  applyStateLoad.abort()
  // Clear stale stage state when returning to non-story screens.
  if (!getStepSceneState(step)) {
    if (props.fallbackBg) {
      manager.setBackground(props.fallbackBg)
    } else {
      manager.clearBackground()
    }
    manager.setCameraFilter(null)
    manager.setIdolBackgroundColorFilter?.(null)
    manager.clearBgBlur()
    manager.clearBgColor()
    manager.applyBgEffects?.([])
    manager.clearScreenSlide?.()
    if (Object.keys(manager.spineInstances).length > 0) {
      manager.clearAllSpines()
      if (debugMode.value) Object.keys(spineStates).forEach(k => delete spineStates[k])
    }
    boundsSnapshot.value = null
    return
  }
  const newId = Number(step?.step_id)
  const oldId = Number(oldStep?.step_id)
  const resetScreenEffects = Number.isFinite(newId)
    && Number.isFinite(oldId)
    && (newId < oldId || newId > oldId + 1)
  applyState(step, { resetScreenEffects })
})

watch(() => props.fallbackBg, () => {
  if (!manager) return
  if (props.manageBackground) {
    syncManagedBackground()
    return
  }
  if (getStepSceneState(props.step)?.bg) return
  if (props.fallbackBg) manager.setBackground(props.fallbackBg)
  else manager.clearBackground()
})

async function applyState(step, { resetScreenEffects = false } = {}) {
  if (!manager) return
  const state = getStepSceneState(step)
  if (!state) return
  applyStateLoad.abort()
  applyStateLoad = new AbortController()
  const signal = applyStateLoad.signal
  const token = ++applyStateToken
  projectedStep = null
  projectionFailure = null
  const desired = state.spines || []
  const actors = desired.filter(actor => actor?.id && actor.model && !NON_VISUAL_IDS.has(actor.id))
  const realActors = actors.filter(actor => !isSilhouetteOnlyModel(actor.model))
  const failProjection = error => {
    if (token !== applyStateToken || !manager || signal.aborted) return
    projectionFailure = { step, code: error.code || error.name, message: String(error.message || error) }
    tracePlayer('stage-config-failed', { code: projectionFailure.code, message: projectionFailure.message })
  }
  // Metadata is mandatory before actual actor positioning, not before an empty
  // background. Do not eagerly fetch the full actor indexes on mount.
  if (actors.length) {
    try { await Promise.all([_loadFigurePlacement(signal), realActors.length ? _loadMotionSettings(signal) : null]) }
    catch (error) { failProjection(error); return }
  }
  if (token !== applyStateToken || !manager || signal.aborted) return

  lastScreenEffectsKey = applyStepSceneState({
    manager,
    step,
    state,
    lastScreenEffectsKey,
    resetScreenEffects,
    nowMilliseconds: props.nowMilliseconds,
  })

  const charaId = step.chara_id || ''
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

    const modelId = spineState.model
    const existing = manager.spineInstances[sid]
    // IdolCharacter state; compiled idol_zoom_y_offset (an old site-side guess) is ignored.
    const placement = {
      posX: spineState.pos_x ?? 0,
      posY: spineState.pos_y ?? 0,
      zoomX: spineState.idol_zoom_x ?? 0,
      zoomY: spineState.idol_zoom_y ?? 0,
      zoom: spineState.idol_zoom ?? 1,
    }
    const transitions = {
      position: spineState.slide_duration > 0 ? { duration: spineState.slide_duration } : null,
      zoom: spineState.idol_zoom_transition || null,
      nowMilliseconds: props.nowMilliseconds,
    }
    const texture = figurePlacement?.textures?.[modelId] || null

    if (isSilhouetteOnlyModel(modelId) || manager.hasSilhouetteFallback?.(sid, modelId)) {
      if (existing) manager.removeSpine(sid, true)
      manager.showSilhouette(sid, modelId, texture, placement, transitions)
      continue
    }

    if (existing && existing.modelId === modelId) {
      // Same model: update face/anim and reposition.
      if (spineState.face) manager.updateSpineFace(sid, spineState.face, spineState)
      applyStateBodyMotion(manager, sid, modelId, spineState, step)
      if (spineState.neck_anim_stop) manager.stopSpineNeckAnim?.(sid, `state:${step.step_id}:neck-stop:${sid}`)
      else if (spineState.neck_anim) manager.playSpineNeckAnim?.(sid, spineState.neck_anim, `state:${step.step_id}:neck:${sid}:${spineState.neck_anim}`)
      manager.setSpinePartsVisible?.(sid, spineState.parts_visible !== false)
      manager.flushSpinePose?.(sid, 0)
      manager.placeActor(sid, placement, transitions)
      const colorTransition = spineState.idol_color_transition || {}
      manager.setSpineColor(
        sid,
        spineState.idol_color || null,
        colorTransition.duration ?? 0,
        colorTransition.delay ?? 0,
        props.nowMilliseconds,
      )
      if (spineState.fade?.type) {
        const targetAlpha = spineState.fade.type === 'out' ? 0 : 1
        manager.animateSpineAlpha?.(sid, targetAlpha, spineState.fade.duration, spineState.fade.delay, props.nowMilliseconds)
      } else {
        manager.setSpineAlpha?.(sid, 1)
      }
    } else {
      // Different model or new model: remove old, then spawn new.
      if (existing) manager.removeSpine(sid, true)
      try {
        await manager.spawnSpine(sid, modelId, {
          isCurrent: () => token === applyStateToken && !!manager,
          signal,
          figure: { prefabY: figurePlacement?.skeletons?.[modelId] ?? 0 },
          placement,
          deferReveal: true,
          fadeInDuration: spineState.fade?.type === 'in' ? spineState.fade.duration : undefined,
        })
        if (token !== applyStateToken || !manager) {
          return
        }
        const entry = manager.spineInstances[sid]
        if (!entry) {
          // Spine asset not found — try silhouette fallback
          manager.showSilhouette(sid, modelId, texture, placement)
          continue
        }
        if (spineState.face) manager.updateSpineFace(sid, spineState.face, spineState)
        applyStateBodyMotion(manager, sid, modelId, spineState, step)
        if (spineState.neck_anim_stop) manager.stopSpineNeckAnim?.(sid, `state:${step.step_id}:neck-stop:${sid}`)
        else if (spineState.neck_anim) manager.playSpineNeckAnim?.(sid, spineState.neck_anim, `state:${step.step_id}:neck:${sid}:${spineState.neck_anim}`)
        manager.setSpinePartsVisible?.(sid, spineState.parts_visible !== false)
        manager.flushSpinePose?.(sid, 0)
        const colorTransition = spineState.idol_color_transition || {}
        manager.setSpineColor(
          sid,
          spineState.idol_color || null,
          colorTransition.duration ?? 0,
          colorTransition.delay ?? 0,
          props.nowMilliseconds,
        )
        if (spineState.fade?.type) {
          const targetAlpha = spineState.fade.type === 'out' ? 0 : 1
          manager.animateSpineAlpha?.(sid, targetAlpha, spineState.fade.duration, spineState.fade.delay, props.nowMilliseconds)
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
    const orderedIds = storySpineOrder(desiredOrder)
    manager.applySpineOrder?.(orderedIds)
  } else if (charaId && desiredIds.has(charaId)) {
    manager.bringToFront(charaId)
  }

  projectedStep = step
  // Manager creation is not actor readiness: spawn may clear queued talking.
  // Consumers can now bind the current audio clock after the real projection.
  emit('scene-ready', step)

  syncBoundsSnapshot(step)
  if (debugMode.value) syncStates()
  scheduleStageDebugPublish()
}

function isSpineReady(target, expectedStep) {
  return !!manager?.spineInstances?.[target]
    && isSceneProjected(expectedStep)
}

function isSceneProjected(expectedStep) {
  return !!manager && props.step === expectedStep
    && (!getStepSceneState(expectedStep) || projectedStep === expectedStep)
}

function getSceneReadiness(expectedStep) {
  if (manager && props.step === expectedStep && projectionFailure?.step === expectedStep) {
    return { status: 'blocked', reason: 'actor-configuration', code: projectionFailure.code, message: projectionFailure.message }
  }
  if (!manager || props.step !== expectedStep || !isSceneProjected(expectedStep)) {
    return { status: 'waiting', reason: 'actor-projection' }
  }
  const desiredIds = (getStepSceneState(expectedStep)?.spines || [])
    .filter(item => item?.id && item?.model && !NON_VISUAL_IDS.has(item.id))
    .map(item => item.id)
  const pending = desiredIds.filter(id => manager._silhouettePending?.[id])
  if (pending.length) return { status: 'waiting', reason: 'silhouette-image', ids: pending }
  const missing = desiredIds.filter(id => !manager.spineInstances?.[id] && !manager._silhouetteSprites?.[id])
  if (missing.length) return { status: 'blocked', reason: 'actor-renderable', ids: missing }
  return { status: 'ready' }
}

defineExpose({
  get manager() { return manager },
  isSpineReady,
  isSceneProjected,
  getSceneReadiness,
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
