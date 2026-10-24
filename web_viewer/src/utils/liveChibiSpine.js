import { attachObjectEmitters } from '../core/chibiObjectEmitters.js'
import { attachBuiltInObjects } from '../core/chibiBuiltInObjects.js'
import { attachSearchlights } from '../core/chibiSearchlights.js'
import { attachWholeScreen } from '../core/chibiWholeScreen.js'
import { attachNativeOldSuspension, validateOldSuspensionTrack } from '../core/chibiOldSuspensionlights.js'
import { attachNativeSuspensionSprites } from '../core/chibiSuspensionlights.js'
import { attachNativeSpotlights } from '../core/chibiSpotlightTimeline.js'
import { attachObjectSpriteGeometry } from '../core/chibiObjectSpriteGeometry.js'
import { attachBloom } from '../core/chibiBloomParticles.js'
import { validateStagelightData } from '../core/chibiStagelights.js'
import {createBoundedTextTransport} from './BoundedTextTransport.js'
import {createStageIndexTransport} from './StageIndexTransport.js'
import {loadChoreographyCatalog,loadChoreographySong,validateChoreographyBinding} from '../core/chibiChoreographyShards.js'
import {loadStageEffectSong} from '../core/chibiStageEffectShards.js'
import {loadPenlightSong,loadObjectEmitterSelection} from '../core/chibiConsumerShards.js'
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
import { withLoadDeadline } from '../core/AsyncLoadBoundary.js'
import { attachChibiParticleLayers } from '../core/chibiParticleTimeline.js'
import { attachChibiFloor } from '../core/chibiFloorParticles.js'
import { validateStageCommandInventory } from '../core/stageCommandCoverage.js'
import { validatePenlightData } from '../core/chibiPenlights.js'
import { NATIVE_MOUTH_CLOSED_RATE, validateMouthFixData } from '../core/chibiMouthFix.js'
import { validateFootSoloData } from '../core/chibiNativeFootColors.js'
import {validateSmokeData} from '../core/chibiSmoke.js'
import {SMOKE_BINDING} from '../core/chibiSmokeMotion.js'
import { validateMotionOffsetData } from '../core/chibiMotionOffset.js'
import { validateMotionClock } from '../core/chibiMotionClock.js'
import { validateOriginalLineups } from '../core/chibiOriginalLineups.js'

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

// Bound source-equivalent bytes; each retained document parses and hashes once.
// Song sharding is still needed to reduce the size of the global inputs.
const indexTransport = createStageIndexTransport()
const binaryTransport = createBoundedTextTransport({binary:true,maxBytes:4*1024*1024,cacheBytes:8*1024*1024,maxEntries:48,timeoutMs:25000})
async function liveJson(relativePath, options={}, optional=false) {
  const url=`${LIVE_CHIBI_BASE}/${relativePath}`
  try {return (await indexTransport.load(url,options)).data}
  catch(error) {if(error.status===404 && optional)return null; if(error.name!=='AbortError')indexTransport.invalidate(url); throw error}
}
export const fetchLiveChibiManifest = options => liveJson('manifest.json',options)
export const fetchLiveChibiOriginalLineups = async options => validateOriginalLineups((await indexTransport.load('/data/stage-original-lineups.json',options)).data)
export async function fetchLiveChibiChoreography(file,{signal,sharded=false}={}) {
  if(sharded)return (await loadChoreographyCatalog(indexTransport,file,{signal})).index
  const [text,spotlights,wholeScreen,searchlights]=await Promise.all([
    indexTransport.load(`${LIVE_CHIBI_BASE}/${file}`,{signal}),
    indexTransport.load('/data/stage-spotlight-commands.json',{signal}),
    indexTransport.load('/data/stage-whole-screen.json',{signal}),
    indexTransport.load('/data/stage-searchlights.json',{signal}),
  ])
  const hash=await text.hash()
  if(signal?.aborted)throw new DOMException('Request cancelled','AbortError')
  return attachSearchlights(attachWholeScreen(attachNativeSpotlights(text.data,spotlights.data,hash),wholeScreen.data,hash),searchlights.data,hash)
}
export const fetchLiveChibiSongChoreography = (file,id,options) => loadChoreographySong(indexTransport,file,id,options)
export async function fetchLiveChibiCommandInventory(file, {signal,binding} = {}) {
  // Sharded playback uses the catalog's explicit canonical-source binding.
  // Full-corpus callers continue to digest the actual canonical document.
  const [text, choreographyText] = await Promise.all([
    indexTransport.load('/data/stage-command-inventory.json', {signal}),
    binding ? null : indexTransport.load(`${LIVE_CHIBI_BASE}/${file}`, {signal}),
  ])
  const hash = binding ? validateChoreographyBinding(binding,file).sha256 : await choreographyText.hash()
  if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError')
  return validateStageCommandInventory(text.data, hash)
}
export const fetchLiveChibiMusicIndex = options => liveJson('music/index.json',options,true)
export async function fetchLiveChibiPenlights(file, {signal,binding,songId}={}) {
  if(songId){validateChoreographyBinding(binding,file);return loadPenlightSong(indexTransport,songId,{signal,binding})}
  const [text,modelText,choreographyText]=await Promise.all([
    indexTransport.load('/data/stage-penlight-commands.json',{signal}),
    indexTransport.load(`${LIVE_CHIBI_BASE}/penlight/index.json`,{signal}),
    binding ? null : indexTransport.load(`${LIVE_CHIBI_BASE}/${file}`,{signal}),
  ])
  const [choreographyHash,modelHash]=await Promise.all([binding ? validateChoreographyBinding(binding,file).sha256 : choreographyText.hash(),modelText.hash()])
  if(signal?.aborted)throw new DOMException('Request cancelled','AbortError')
  return {commands:validatePenlightData(text.data,choreographyHash,modelHash),model:modelText.data}
}
export async function fetchLiveChibiMouthFix(file,{signal,binding}={}) {
  const [text,choreographyText]=await Promise.all([
    indexTransport.load('/data/stage-mouth-fix.json',{signal}),
    binding ? null : indexTransport.load(`${LIVE_CHIBI_BASE}/${file}`,{signal}),
  ])
  const hash=binding ? validateChoreographyBinding(binding,file).sha256 : await choreographyText.hash()
  if(signal?.aborted)throw new DOMException('Request cancelled','AbortError')
  return validateMouthFixData(text.data,hash)
}
export async function fetchLiveChibiFootSolo(file,{signal,binding}={}) {
  const [text,choreographyText]=await Promise.all([
    indexTransport.load('/data/stage-foot-solo.json',{signal}),
    binding ? null : indexTransport.load(`${LIVE_CHIBI_BASE}/${file}`,{signal}),
  ])
  const hash=binding ? validateChoreographyBinding(binding,file).sha256 : await choreographyText.hash()
  if(signal?.aborted)throw new DOMException('Request cancelled','AbortError')
  return validateFootSoloData(text.data,hash)
}
export async function fetchLiveChibiSmoke(file,{signal,binding}={}) {
  const [text,choreographyText]=await Promise.all([
    indexTransport.load('/data/stage-smoke.json',{signal}),
    binding?null:indexTransport.load(`${LIVE_CHIBI_BASE}/${file}`,{signal}),
  ])
  const hash=binding?validateChoreographyBinding(binding,file).sha256:await choreographyText.hash()
  if(signal?.aborted)throw new DOMException('Request cancelled','AbortError')
  if(await text.hash()!==SMOKE_BINDING.dataSha256)throw Error('Smoke payload identity mismatch')
  return validateSmokeData(text.data,hash)
}
export async function fetchLiveChibiMotionOffset(file,{signal,binding}={}) {
  const [text,choreographyText]=await Promise.all([
    indexTransport.load('/data/stage-motion-offset.json',{signal}),
    binding ? null : indexTransport.load(`${LIVE_CHIBI_BASE}/${file}`,{signal}),
  ])
  const hash=binding ? validateChoreographyBinding(binding,file).sha256 : await choreographyText.hash()
  if(signal?.aborted)throw new DOMException('Request cancelled','AbortError')
  return validateMotionOffsetData(text.data,hash)
}
export async function fetchLiveChibiMotionClock(file,{signal,binding}={}) {
  const [text,choreographyText]=await Promise.all([
    indexTransport.load('/data/stage-motion-clock.json',{signal}),
    binding ? null : indexTransport.load(`${LIVE_CHIBI_BASE}/${file}`,{signal}),
  ])
  const hash=binding ? validateChoreographyBinding(binding,file).sha256 : await choreographyText.hash()
  if(signal?.aborted)throw new DOMException('Request cancelled','AbortError')
  return validateMotionClock(text.data,hash,binding?.songs ?? choreographyText.data.songs)
}
export async function fetchLiveChibiStagelights(file,{signal,binding}={}) {
  const [text,choreographyText]=await Promise.all([
    indexTransport.load('/data/stage-stagelight-commands.json',{signal}),
    binding ? null : indexTransport.load(`${LIVE_CHIBI_BASE}/${file}`,{signal}),
  ])
  const hash=binding ? validateChoreographyBinding(binding,file).sha256 : await choreographyText.hash()
  if(signal?.aborted)throw new DOMException('Request cancelled','AbortError')
  return validateStagelightData(text.data,hash)
}
export const fetchLiveChibiBackmonitorIndex = options => liveJson('backmonitor/index.json',options,true)
export const fetchLiveChibiImageLayerIndex = options => liveJson('image-layers/index.json',options,true)
export const fetchLiveChibiImageObjectIndex = options => liveJson('image-objects/index.json',options,true)
export const fetchLiveChibiStageEffectSong = (id,options) => loadStageEffectSong(indexTransport,id,options)
export async function fetchLiveChibiStageEffectIndex({signal}={}) {
  const [text,native,sprites]=await Promise.all([
    indexTransport.load(`${LIVE_CHIBI_BASE}/stage-effects/index.json`,{signal}),
    indexTransport.load('/data/stage-old-suspension.json',{signal}),
    indexTransport.load('/data/stage-new-suspension-sprites.json',{signal}),
  ])
  const hash=await text.hash()
  if(signal?.aborted)throw new DOMException('Request cancelled','AbortError')
  return attachNativeSuspensionSprites(attachNativeOldSuspension(text.data,native.data,hash),sprites.data,hash)
}
export async function fetchLiveChibiOldSuspensionTrack(descriptor,{signal}={}) {
  const text=await indexTransport.load(`${LIVE_CHIBI_BASE}/${descriptor.file}`,{signal})
  const hash=await text.hash()
  if(signal?.aborted)throw new DOMException('Request cancelled','AbortError')
  return validateOldSuspensionTrack(text.data,descriptor,hash)
}
export const fetchLiveChibiLipSync = (file,options) => file ? liveJson(file,options) : Promise.resolve(null)
export async function fetchLiveChibiObjectLayerIndex({signal,onOptional,binding,song}={}) {
  let objectText
  try {objectText=await indexTransport.load(`${LIVE_CHIBI_BASE}/object-layers/index.json`,{signal})}
  catch(error) {if(error.status===404)return null;throw error}
  let index=objectText.data
  const [emitterText,choreographyText,builtInText]=await Promise.all([song ? loadObjectEmitterSelection(indexTransport,song,{signal,binding}).then(data=>({data})) : indexTransport.load('/data/stage-object-emitters.json',{signal}),binding ? null : indexTransport.load(`${LIVE_CHIBI_BASE}/choreography/index.json`,{signal}),indexTransport.load('/data/stage-built-in-objects.json',{signal})])
  const [objectHash,choreographyHash]=await Promise.all([objectText.hash(),binding ? validateChoreographyBinding(binding,'choreography/index.json').sha256 : choreographyText.hash()])
  if(signal?.aborted)throw new DOMException('Request cancelled','AbortError')
  index=attachObjectEmitters(index,emitterText.data,objectHash,choreographyHash)
  index=attachBuiltInObjects(index,builtInText.data,objectHash)
  // Start refinements independently; never mutate the shared cached source.
  let refined=index
  for(const [file,attach] of [['particle-layers',attachChibiParticleLayers],['floor-particles',attachChibiFloor]]) {
    void liveJson(`${file}/index.json`,{signal},true).then(extra=> {
      if(!signal?.aborted && extra) {refined=attach(refined,extra); onOptional?.(refined)}
    }).catch(error=> {if(error.name!=='AbortError')console.warn('[ChibiStage] optional particle index unavailable',error)})
  }
  void indexTransport.load('/data/stage-bloom-particles.json',{signal}).then(text=>{
      if(!signal?.aborted){refined=attachBloom(refined,text.data,objectHash);onOptional?.(refined)}
    }).catch(error=>{if(error.name!=='AbortError')console.warn('[ChibiStage] bloom index unavailable',error)})
  void indexTransport.load('/data/stage-object-sprite-geometry.json',{signal}).then(text=>{
      if(!signal?.aborted){refined=attachObjectSpriteGeometry(refined,text.data,objectHash);onOptional?.(refined)}
    }).catch(error=>{if(error.name!=='AbortError')console.warn('[ChibiStage] object Sprite geometry unavailable',error)})
  return index
}
export async function fetchLiveChibiStageBackgroundIndex({signal,onOptional}={}) {
  const index=await liveJson('stage-backgrounds/index.json',{signal},true)
  if(index) void liveJson('image-components/index.json',{signal},true).then(components=> {
    if(!signal?.aborted && components)onOptional?.({...index,components})
  }).catch(error=> {if(error.name!=='AbortError')console.warn('[ChibiStage] optional background components unavailable',error)})
  return index
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
  const headSlot = skeleton.findSlot('head')

  const baseScaleX = mouthBone.data.scaleX
  const baseScaleY = mouthBone.data.scaleY
  const originalUpdateWorldTransform = skeleton.updateWorldTransform
  const state = {
    value: 0,
    singing: false,
    attachment: null,
    scale: LIVE_CHIBI_LIP_CLOSED_SCALE,
    fixed: null,
  }
  skeleton.updateWorldTransform = function (...args) {
    try {
      const currentName = mouthSlot.attachment?.name || mouthSlot.data.attachmentName || 'mouth_open'
      const headName=headSlot?.attachment?.name
      const fixed=state.fixed?.active===true
      const flipped = fixed && headName ? headName==='head_fl' : currentName.endsWith('_fl')
      const value = fixed ? state.fixed.rate : state.singing ? state.value : 0
      const open = value > (fixed?NATIVE_MOUTH_CLOSED_RATE:LIVE_CHIBI_LIP_OPEN_THRESHOLD)
      const attachmentName = `mouth_${open ? 'open' : 'close'}${flipped ? '_fl' : ''}`
      if (mouthSlot.attachment?.name !== attachmentName) {
        skeleton.setAttachment('mouth', attachmentName)
      }
      state.scale = fixed ? (open?value:1) : open
        ? LIVE_CHIBI_LIP_OPEN_SCALE_MIN
          + value * (LIVE_CHIBI_LIP_OPEN_SCALE_MAX - LIVE_CHIBI_LIP_OPEN_SCALE_MIN)
        : LIVE_CHIBI_LIP_CLOSED_SCALE
      mouthBone.scaleX = fixed ? state.scale : baseScaleX * state.scale
      if(!fixed)mouthBone.scaleY = baseScaleY
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

export function applyLiveChibiLipSync(runtime, curve, milliseconds, singing, fixed=null) {
  const controller = runtime?.lipSyncController
  if (!controller) return {
    value: 0,
    singing: false,
    attachment: null,
    scale: LIVE_CHIBI_LIP_CLOSED_SCALE,
  }
  controller.value = singing ? sampleLiveChibiLipSync(curve, milliseconds) : 0
  controller.singing = Boolean(singing && curve)
  controller.fixed = fixed?.active ? fixed : null
  runtime.spine.skeleton.updateWorldTransform()
  return {
    value: controller.value,
    singing: controller.singing,
    attachment: controller.attachment,
    scale: controller.scale,
    fixed: controller.fixed,
  }
}

async function fetchBuffer(relativePath,options={}) {
  const bytes=await binaryTransport.load(`${LIVE_CHIBI_BASE}/${relativePath}`,options)
  return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)
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

function loadTexture(url,{signal}={}) {
  return withLoadDeadline(owner=>new Promise((resolve,reject)=> {
    const image=new Image()
    const cleanup=()=> {image.onload=null; image.onerror=null; owner.removeEventListener('abort',cancel)}
    const cancel=()=> {cleanup();image.src='';reject(owner.reason || new DOMException('Cancelled','AbortError'))}
    owner.addEventListener('abort',cancel,{once:true})
    image.onload=()=> {cleanup();const baseTexture=new PIXI.BaseTexture(image);baseTexture.alphaMode=PIXI.ALPHA_MODES.PMA;resolve(new PIXI.Texture(baseTexture))}
    image.onerror=()=> {cleanup();reject(Error('服装贴图加载失败'))}
    image.src=url
  }),{signal,timeoutMs:25000,label:'chibi-texture'})
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

export async function createLiveChibi(character, costume, {signal,isCurrent=()=>true}={}) {
  const [setupBuffer, atlasBuffer] = await Promise.all([
    fetchBuffer(character.setup,{signal}),
    fetchBuffer(costume.atlas,{signal}),
  ])
  const atlasText = decodeUnityTextAsset(atlasBuffer)
  const textureFileName = atlasText
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => /\.(png|jpg)$/i.test(line)) || 'cos.png'
  let texture,atlas,spine
  try {
  texture = await loadTexture(`${LIVE_CHIBI_BASE}/${costume.texture}`,{signal})
  if(signal?.aborted || !isCurrent())throw new DOMException('Superseded','AbortError')
  atlas = await createAtlas(atlasText, texture, textureFileName)
  atlas.pages.forEach(page => { page.pma = true })

  // The shared setup skeleton contains optional accessories for every costume.
  // A selected costume atlas only ships its own regions, so absent attachments
  // must be skipped rather than treated as a fatal atlas error.
  const attachmentLoader = new CostumeAtlasAttachmentLoader(atlas)
  const skeletonBinary = new SkeletonBinary(attachmentLoader)
  const skeletonData = skeletonBinary.readSkeletonData(new Uint8Array(setupBuffer))
  spine = new Spine(skeletonData)
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
  // LiveIdolFactory creates a new SkeletonDataAsset: ctor leaves defaultMix=0,
  // and the source arrays contain no per-pair mixes. Normal PlayMotion's
  // callback explicitly supplies .15s only for its first fragment; queued
  // before/after/loop fragments and immediate commands retain the zero default.
  spine.stateData.defaultMix = 0
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
  } catch(error) {spine?.destroy({children:true}); atlas?.dispose?.(); texture?.destroy(true); throw error}
}

export async function injectLiveChibiMotion(runtime, motion, { isCurrent = () => true, signal } = {}) {
  if (runtime.disposed || !isCurrent()) return []
  if (runtime.loadedMotions?.has(motion.id)) {
    return runtime.loadedMotions.get(motion.id)
  }

  const motionFile = motion.file.replace('{bodyType}', String(runtime.bodyType))
  const buffer = await fetchBuffer(motionFile,{signal})
  if (runtime.disposed || !isCurrent()) return []
  // Parallel consumers may have installed it while the shared bytes arrived.
  if (runtime.loadedMotions?.has(motion.id)) return runtime.loadedMotions.get(motion.id)
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

// A single large AnimationState update cannot cross a queued main→loop
// transition faithfully: trackLast is populated by the preceding apply.
// Replay CPU pose steps, then refresh render attachments once at the end.
export function seekLiveChibiMotion(runtime, seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Invalid motion seek time')
  const { state, skeleton } = runtime.spine
  const priorSpeed = state.timeScale
  state.timeScale = 1
  try {
    let remaining = seconds
    while (remaining > 1e-9) {
      const step = Math.min(remaining, 1 / 60)
      state.update(step)
      state.apply(skeleton)
      remaining -= step
    }
    // Refresh Pixi attachments without another AnimationState.update. Even
    // delta=0 can consume a queued entry whose trackLast just reached delay;
    // that would advance seek one state update beyond normal playback.
    const updateState = state.update
    state.update = () => {}
    try { runtime.spine.update(0) } finally { state.update = updateState }
  } finally {
    state.timeScale = priorSpeed
  }
}

export function playLiveChibiMotion(runtime, animationNames, {
  paused = false,
  reset = false,
  mode = 2,
  mixDuration = 0.12,
  nativeCommand = false,
  skip = false,
} = {}) {
  if (!animationNames?.length) return
  // PlayMotion has separate isLoop and skip arguments. Its normal callback
  // (0x1bbe040) plays dance, or before -> after, then queues loop for mode 2.
  // Only mode 3 / SkipEffect takes the immediate branch in 0x221c094.
  const immediate = nativeCommand && (skip || Number(mode) === 3)
  const wantsLoop = Number(mode) === 2 || Number(mode) === 3
  const directLoop = immediate && wantsLoop
  const danceName = animationNames.find(name => name.includes('_3dance'))
  const afterName = animationNames.find(name => name.includes('_2after'))
  const mainName = nativeCommand
    ? directLoop ? animationNames.find(name => name.includes('_4loop'))
      : danceName || (immediate ? afterName : animationNames.find(name => name.includes('_1before')))
    : danceName || animationNames[0]
  const loopName = animationNames.find(name => name.includes('_4loop')) || (!nativeCommand ? animationNames[1] : null)
  const needsAfter = nativeCommand && !immediate && !danceName
  const queueLoop = !directLoop && (nativeCommand ? wantsLoop : Boolean(loopName))
  if (!mainName || needsAfter && !afterName || queueLoop && !loopName) {
    throw new Error(`Live motion has no native fragment for mode ${mode}`)
  }
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

  const mainEntry = state.setAnimation(0, mainName, directLoop)
  if (!shouldReset && mainEntry.mixingFrom) {
    mainEntry.mixDuration = nativeCommand ? (immediate ? 0 : 0.15) : mixDuration
    mainEntry.mixingFrom.attachmentThreshold = 0
    mainEntry.mixingFrom.drawOrderThreshold = 0
  } else {
    mainEntry.mixDuration = 0
  }

  let loopEntry = null
  if (needsAfter) state.addAnimation(0, afterName, false, 0)
  if (queueLoop) {
    const mainAnimation = runtime.skeletonData.findAnimation(mainName)
    // Native AddAnimationByPrefix passes delay=0 (0x2080aa4), letting Spine
    // account for the queued entry's mix. Preview deliberately demonstrates
    // the full main duration before handing off to loop.
    loopEntry = state.addAnimation(0, loopName, true, nativeCommand ? 0 : mainAnimation?.duration || 0)
    if (!nativeCommand) loopEntry.mixDuration = Math.min(0.08, mixDuration)
  }
  runtime.spine.state.timeScale = paused ? 0 : 1
  runtime.spine.update(0)
  runtime.currentTrackEntry = mainEntry
  runtime.currentMotionPlayback = {
    mainName,
    policy: nativeCommand ? 'native-command' : 'preview-main-loop',
    loop: directLoop,
    skip: immediate,
    sequence: [mainName, ...(needsAfter ? [afterName] : []), ...(queueLoop ? [loopName] : [])],
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
  runtime.disposed = true
  runtime.spine?.removeFromParent()
  runtime.spine?.destroy({ children: true })
  runtime.atlas?.dispose?.()
  runtime.texture?.destroy(true)
}
