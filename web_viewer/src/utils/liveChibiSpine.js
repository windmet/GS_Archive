import * as PIXI from 'pixi.js'
import {
  AtlasAttachmentLoader,
  MeshAttachment,
  RegionAttachment,
  SkeletonBinary,
  Skin,
  Spine,
} from '@pixi-spine/runtime-3.8'
import { BinaryInput, TextureAtlas, TextureAtlasRegion } from '@pixi-spine/base'

export const LIVE_CHIBI_BASE = '/assets/live-chibi'
const LIVE_CHIBI_LIP_OPEN_THRESHOLD = 0.04
const LIVE_CHIBI_LIP_CLOSED_SCALE = 1
const LIVE_CHIBI_LIP_OPEN_SCALE_MIN = 0.4
const LIVE_CHIBI_LIP_OPEN_SCALE_MAX = 1.4

class CostumeAtlasAttachmentLoader extends AtlasAttachmentLoader {
  missingRegions = new Set()
  transparentRegion = null

  placeholderRegion() {
    if (!this.transparentRegion) {
      this.transparentRegion = new TextureAtlasRegion()
      this.transparentRegion.name = '__missing__'
      this.transparentRegion.texture = PIXI.Texture.EMPTY
    }
    return this.transparentRegion
  }

  newRegionAttachment(...args) {
    try {
      return super.newRegionAttachment(...args)
    } catch (error) {
      if (String(error?.message || error).includes('Region not found in atlas')) {
        this.missingRegions.add(args[2])
        const attachment = new RegionAttachment(args[1])
        attachment.region = this.placeholderRegion()
        attachment.color.a = 0
        return attachment
      }
      throw error
    }
  }

  newMeshAttachment(...args) {
    try {
      return super.newMeshAttachment(...args)
    } catch (error) {
      if (String(error?.message || error).includes('Region not found in atlas')) {
        this.missingRegions.add(args[2])
        const attachment = new MeshAttachment(args[1])
        attachment.region = this.placeholderRegion()
        attachment.color.a = 0
        return attachment
      }
      throw error
    }
  }
}

export async function fetchLiveChibiManifest() {
  const response = await fetch(`${LIVE_CHIBI_BASE}/manifest.json`)
  if (!response.ok) throw new Error(`资源索引加载失败 (${response.status})`)
  return response.json()
}

export async function fetchLiveChibiChoreography(relativePath) {
  const response = await fetch(`${LIVE_CHIBI_BASE}/${relativePath}`)
  if (!response.ok) throw new Error(`歌曲编排索引加载失败 (${response.status})`)
  return response.json()
}

export async function fetchLiveChibiMusicIndex() {
  const response = await fetch(`${LIVE_CHIBI_BASE}/music/index.json`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`歌曲音频索引加载失败 (${response.status})`)
  return response.json()
}

export async function fetchLiveChibiLipSync(relativePath) {
  if (!relativePath) return null
  const response = await fetch(`${LIVE_CHIBI_BASE}/${relativePath}`)
  if (!response.ok) throw new Error(`唇部曲线加载失败 (${response.status})`)
  return response.json()
}

export function sampleLiveChibiLipSync(curve, milliseconds) {
  const values = curve?.values
  if (!Array.isArray(values) || values.length === 0) return 0
  const sampleRate = Number(curve.sampleRate) || 60
  const position = Math.max(0, milliseconds) * sampleRate / 1000
  const index = Math.min(Math.floor(position), values.length - 1)
  const nextIndex = Math.min(index + 1, values.length - 1)
  const fraction = Math.min(1, Math.max(0, position - index))
  const a = Number(values[index]) || 0
  const b = Number(values[nextIndex]) || 0
  return Math.min(1, Math.max(0, a + (b - a) * fraction))
}

function installLiveChibiLipSync(spine) {
  const skeleton = spine.skeleton
  const mouthSlot = skeleton.findSlot('mouth')
  const mouthBone = skeleton.findBone('mouth') || mouthSlot?.bone
  if (!mouthSlot || !mouthBone) return null

  const baseScaleX = mouthBone.data.scaleX
  const baseScaleY = mouthBone.data.scaleY
  const originalUpdateWorldTransform = skeleton.updateWorldTransform
  const state = {
    value: 0,
    singing: false,
    attachment: null,
    scale: LIVE_CHIBI_LIP_CLOSED_SCALE,
  }
  skeleton.updateWorldTransform = function (...args) {
    try {
      const currentName = mouthSlot.attachment?.name || mouthSlot.data.attachmentName || 'mouth_open'
      const flipped = currentName.endsWith('_fl')
      const value = state.singing ? state.value : 0
      const open = value > LIVE_CHIBI_LIP_OPEN_THRESHOLD
      const attachmentName = `mouth_${open ? 'open' : 'close'}${flipped ? '_fl' : ''}`
      if (mouthSlot.attachment?.name !== attachmentName) {
        skeleton.setAttachment('mouth', attachmentName)
      }
      state.scale = open
        ? LIVE_CHIBI_LIP_OPEN_SCALE_MIN
          + value * (LIVE_CHIBI_LIP_OPEN_SCALE_MAX - LIVE_CHIBI_LIP_OPEN_SCALE_MIN)
        : LIVE_CHIBI_LIP_CLOSED_SCALE
      mouthBone.scaleX = baseScaleX * state.scale
      mouthBone.scaleY = baseScaleY
      state.attachment = attachmentName
    } finally {
      originalUpdateWorldTransform.apply(this, args)
    }
  }
  // The setup pose uses mouth_open. Apply a silent frame immediately so the
  // preview starts neutral even before a song curve has loaded.
  skeleton.updateWorldTransform()
  return state
}

export function applyLiveChibiLipSync(runtime, curve, milliseconds, singing) {
  const controller = runtime?.lipSyncController
  if (!controller) return {
    value: 0,
    singing: false,
    attachment: null,
    scale: LIVE_CHIBI_LIP_CLOSED_SCALE,
  }
  controller.value = singing ? sampleLiveChibiLipSync(curve, milliseconds) : 0
  controller.singing = Boolean(singing && curve)
  runtime.spine.skeleton.updateWorldTransform()
  return {
    value: controller.value,
    singing: controller.singing,
    attachment: controller.attachment,
    scale: controller.scale,
  }
}

async function fetchBuffer(relativePath) {
  const response = await fetch(`${LIVE_CHIBI_BASE}/${relativePath}`)
  if (!response.ok) throw new Error(`${relativePath} 加载失败 (${response.status})`)
  return response.arrayBuffer()
}

function decodeUnityTextAsset(buffer) {
  if (buffer.byteLength < 12) return new TextDecoder().decode(buffer)
  const view = new DataView(buffer)
  const nameLength = view.getUint32(0, true)
  if (nameLength > 0 && nameLength < 200 && 4 + nameLength < buffer.byteLength) {
    let printable = true
    for (let index = 0; index < nameLength; index += 1) {
      const byte = view.getUint8(4 + index)
      if (byte < 0x20 || byte > 0x7e) {
        printable = false
        break
      }
    }
    if (printable) {
      const padding = (4 - ((4 + nameLength) % 4)) % 4
      const contentOffset = 4 + nameLength + padding + 4
      return new TextDecoder().decode(buffer.slice(contentOffset))
    }
  }
  return new TextDecoder().decode(buffer)
}

function readSetupStringTable(buffer) {
  const input = new BinaryInput(new Uint8Array(buffer))
  input.readString() // hash
  input.readString() // Spine version
  input.readFloat() // x
  input.readFloat() // y
  input.readFloat() // width
  input.readFloat() // height
  const nonessential = input.readBoolean()
  if (nonessential) {
    input.readFloat() // fps
    input.readString() // images path
    input.readString() // audio path
  }
  const stringCount = input.readInt(true)
  return Array.from({ length: stringCount }, () => input.readString())
}

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const baseTexture = new PIXI.BaseTexture(image)
      baseTexture.alphaMode = PIXI.ALPHA_MODES.PMA
      resolve(new PIXI.Texture(baseTexture))
    }
    image.onerror = () => reject(new Error('服装贴图加载失败'))
    image.src = url
  })
}

async function createAtlas(atlasText, texture, textureFileName) {
  return new Promise((resolve, reject) => {
    try {
      new TextureAtlas(
        atlasText,
        (path, done) => {
          const requestedFile = path.split('/').pop()
          done(requestedFile === textureFileName ? texture.baseTexture : null)
        },
        result => (result ? resolve(result) : reject(new Error('图集解析失败'))),
      )
    } catch (error) {
      reject(error)
    }
  })
}

export async function createLiveChibi(character, costume) {
  const [setupBuffer, atlasBuffer] = await Promise.all([
    fetchBuffer(character.setup),
    fetchBuffer(costume.atlas),
  ])
  const atlasText = decodeUnityTextAsset(atlasBuffer)
  const textureFileName = atlasText
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => /\.(png|jpg)$/i.test(line)) || 'cos.png'
  const texture = await loadTexture(`${LIVE_CHIBI_BASE}/${costume.texture}`)
  const atlas = await createAtlas(atlasText, texture, textureFileName)
  atlas.pages.forEach(page => { page.pma = true })

  // The shared setup skeleton contains optional accessories for every costume.
  // A selected costume atlas only ships its own regions, so absent attachments
  // must be skipped rather than treated as a fatal atlas error.
  const attachmentLoader = new CostumeAtlasAttachmentLoader(atlas)
  const skeletonBinary = new SkeletonBinary(attachmentLoader)
  const skeletonData = skeletonBinary.readSkeletonData(new Uint8Array(setupBuffer))
  const spine = new Spine(skeletonData)
  const costumeSkin = new Skin(`costume-${costume.id}`)
  const baseSkinNames = ['body', 'head', 'cos_defo']
  const optionalSkinNames = skeletonData.skins
    .filter(skin => !baseSkinNames.includes(skin.name))
    .filter(skin => skin.getAttachments().some(({ attachment }) => (
      attachment?.region && attachment.region.name !== '__missing__'
    )))
    .map(skin => skin.name)
  const selectedSkinNames = [...baseSkinNames, ...optionalSkinNames]
  selectedSkinNames.forEach(skinName => {
    const skin = skeletonData.findSkin(skinName)
    if (skin) costumeSkin.addSkin(skin)
  })
  spine.skeleton.setSkin(costumeSkin)
  spine.skeleton.setSlotsToSetupPose()
  spine.skeleton.updateWorldTransform()
  const lipSyncController = installLiveChibiLipSync(spine)
  const diagnostics = {
    activeAttachments: spine.skeleton.slots.filter(slot => slot.getAttachment()).length,
    width: skeletonData.width,
    height: skeletonData.height,
    eyeSlots: spine.skeleton.slots
      .map(slot => ({
        slot: slot.data.name,
        setup: slot.data.attachmentName,
        attachment: slot.getAttachment()?.name,
        path: slot.getAttachment()?.path,
      }))
      .filter(item => /eye/i.test(`${item.slot} ${item.setup} ${item.attachment} ${item.path}`)),
    headEyeAttachments: (skeletonData.findSkin('head')?.getAttachments() || [])
      .map(entry => ({ slotIndex: entry.slotIndex, name: entry.name, path: entry.attachment?.path }))
      .filter(item => /eye/i.test(`${item.name} ${item.path}`)),
    mouthSlots: spine.skeleton.slots
      .map(slot => ({
        slot: slot.data.name,
        bone: slot.bone?.data?.name,
        setup: slot.data.attachmentName,
        attachment: slot.getAttachment()?.name,
      }))
      .filter(item => /mouth|lip|tooth|tongue/i.test(`${item.slot} ${item.bone} ${item.setup} ${item.attachment}`)),
    mouthBones: spine.skeleton.bones
      .map(bone => ({
        name: bone.data.name,
        parent: bone.parent?.data?.name,
        scaleX: bone.scaleX,
        scaleY: bone.scaleY,
      }))
      .filter(item => /mouth|lip|tooth|tongue/i.test(item.name)),
    mouthAttachments: (skeletonData.findSkin('head')?.getAttachments() || [])
      .map(entry => ({ slotIndex: entry.slotIndex, name: entry.name, path: entry.attachment?.path }))
      .filter(item => /mouth|lip|tooth|tongue/i.test(`${item.name} ${item.path}`)),
    skinAttachmentCounts: Object.fromEntries(
      selectedSkinNames.map(skinName => [
        skinName,
        skeletonData.findSkin(skinName)?.getAttachments().length || 0,
      ]),
    ),
    selectedSkins: selectedSkinNames,
    missingRegions: [...attachmentLoader.missingRegions],
  }
  if (import.meta.env.DEV) window.__SIDE_M_CHIBI_DIAGNOSTICS__ = diagnostics
  // Scripted choreography replaces a running motion at exact song timestamps.
  // Keep a short bone mix available; playLiveChibiMotion hard-switches slots so
  // optional hand/face attachments cannot accumulate during that mix.
  spine.stateData.defaultMix = 0.12
  return {
    bodyType: character.bodyType,
    spine,
    skeletonData,
    skeletonBinary,
    atlas,
    texture,
    lipSyncController,
    diagnostics,
    setupStrings: readSetupStringTable(setupBuffer),
  }
}

export async function injectLiveChibiMotion(runtime, motion) {
  if (runtime.loadedMotions?.has(motion.id)) {
    return runtime.loadedMotions.get(motion.id)
  }

  const motionFile = motion.file.replace('{bodyType}', String(runtime.bodyType))
  const buffer = await fetchBuffer(motionFile)
  // Animation fragments use readStringRef(), whose indexes point into the
  // shared setup skeleton's string table. Without it, attachment keys decode
  // as null and the animation hides entire body parts.
  const input = new BinaryInput(new Uint8Array(buffer), runtime.setupStrings)
  const animationCount = input.readInt(true)
  const animations = []
  for (let index = 0; index < animationCount; index += 1) {
    const name = input.readString()
    const animation = runtime.skeletonBinary.readAnimation(input, name, runtime.skeletonData)
    runtime.skeletonData.animations.push(animation)
    animations.push(animation.name)
  }

  if (!runtime.loadedMotions) runtime.loadedMotions = new Map()
  runtime.loadedMotions.set(motion.id, animations)
  return animations
}

export function playLiveChibiMotion(runtime, animationNames, {
  paused = false,
  reset = false,
  mode = 2,
  mixDuration = 0.12,
} = {}) {
  if (!animationNames?.length) return
  const mainName = animationNames.find(name => name.includes('_3dance')) || animationNames[0]
  const loopName = animationNames.find(name => name.includes('_4loop')) || animationNames[1]
  const state = runtime.spine.state
  const skeleton = runtime.spine.skeleton
  const shouldReset = reset || mode === 3 || !state.getCurrent(0)

  if (shouldReset) {
    state.clearTracks()
    skeleton.setToSetupPose()
  } else {
    // Bone transforms must survive until setAnimation creates its mixingFrom
    // chain. Only reset slots here; the outgoing entry is prevented from
    // restoring its attachments during the bone cross-fade below.
    skeleton.setSlotsToSetupPose()
  }
  skeleton.updateWorldTransform()

  const mainEntry = state.setAnimation(0, mainName, false)
  if (!shouldReset && mainEntry.mixingFrom) {
    mainEntry.mixDuration = mixDuration
    mainEntry.mixingFrom.attachmentThreshold = 0
    mainEntry.mixingFrom.drawOrderThreshold = 0
  } else {
    mainEntry.mixDuration = 0
  }

  let loopEntry = null
  if (loopName) {
    const mainAnimation = runtime.skeletonData.findAnimation(mainName)
    // A positive delay is measured from the previous entry's start. Passing
    // the full duration avoids Spine's delay=0 shortcut, which otherwise
    // begins the loop early by the default mix duration.
    loopEntry = state.addAnimation(0, loopName, true, mainAnimation?.duration || 0)
    loopEntry.mixDuration = Math.min(0.08, mixDuration)
  }
  runtime.spine.state.timeScale = paused ? 0 : 1
  runtime.spine.update(0)
  runtime.currentTrackEntry = mainEntry
  runtime.currentMotionPlayback = {
    mainName,
    loopName: loopEntry?.animation?.name || null,
    mode,
    reset: shouldReset,
    mixingFromPrevious: Boolean(mainEntry.mixingFrom),
    mixDuration: mainEntry.mixDuration,
    attachmentPolicy: shouldReset ? 'full-setup' : 'slots-only',
  }
  return runtime.currentMotionPlayback
}

export function destroyLiveChibi(runtime) {
  if (!runtime) return
  runtime.spine?.removeFromParent()
  runtime.spine?.destroy({ children: true })
  runtime.atlas?.dispose?.()
  runtime.texture?.destroy(true)
}
