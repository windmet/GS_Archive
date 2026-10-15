import { storyAssetTransport } from './StoryAssetTransport.js'
import { withLoadDeadline } from './AsyncLoadBoundary.js'
import { getMouthSettingUrl as defaultGetMouthSettingUrl } from '../utils/AssetResolver.js'
import { mouthSettingCandidates } from '../../shared/story/MouthSettingCandidates.js'
import { SPINE_TRACK } from './spineTracks.js'

// Mirrors client IdolFigureSkeleton.UpdateLip (run from the skeleton's UpdateLocal, after animations apply):
// - MouthInfo is IdolMouthSetting.GetMouthInfo(current face animation, else current motion animation); no
//   entry, or turnOffLipSync, leaves the rig untouched.
// - Lip sample y == 0 (or the curve finished, _shouldCloseMouth): bone "mouth" scaleY = 1, scaleX =
//   closeMouthScale; slot "mouth" = closeMouthAttachmentName, mouth_clip/tooth_top/tooth_bottom/tongue cleared,
//   then attachmentsWhenCloseMouth.
// - Otherwise: bone "mouth" scaleY = sample.x, scaleX = sample.y * openMouthScale; the five slots take the
//   open/clip/upper/lower/tongue names (empty = none), then attachmentsWhenOpenMouth.
// Values are absolute (not relative to the bone's setup scale) and every rig uses the same bone and slots.
const LIP_SLOTS = Object.freeze({
  mouth: ['openMouthAttachmentName', 'closeMouthAttachmentName'],
  mouth_clip: ['openMouthClipAttachmentName', null],
  tooth_top: ['upperTeethAttachmentName', null],
  tooth_bottom: ['lowerTeethAttachmentName', null],
  tongue: ['tongueAttachmentName', null],
})

// Volume callbacks may still hand over a bare opening amount.
function lipSample(callback) {
  const value = callback?.()
  if (value == null) return null
  if (typeof value === 'number') return value > 0 ? { x: 1, y: value } : null
  return value
}

export class LipSyncController {
  constructor({
    getSpineEntry,
    getMouthSettingUrl = defaultGetMouthSettingUrl,
  }) {
    this.getSpineEntry = getSpineEntry
    this.getMouthSettingUrl = getMouthSettingUrl
    this.pendingTalking = {}
    this._mouthLoads = new Map()
  }

  setTalking(idolId, isTalking, volumeCallback = null) {
    const entry = this.getSpineEntry?.(idolId)
    if (!entry) {
      if (isTalking && volumeCallback) {
        this.pendingTalking[idolId] = { volumeCallback }
        console.log(`[PixiStageManager] Queued lip-sync for "${idolId}" until spine load`)
      } else {
        delete this.pendingTalking[idolId]
      }
      return
    }

    const { spine } = entry
    spine._modelName = entry.modelId || '?'
    spine.customIsTalking = isTalking
    if (isTalking && volumeCallback) {
      spine.getVoiceVolume = volumeCallback
    } else if (!isTalking) {
      delete this.pendingTalking[idolId]
      delete spine.getVoiceVolume
    }

    this._installHook(idolId, spine)

    if (isTalking && !spine._mouthData) {
      this._loadMouthSetting(idolId, spine)
    }
  }

  prepare(idolId) {
    const entry = this.getSpineEntry?.(idolId)
    if (!entry?.spine) return
    entry.spine._modelName = entry.modelId || '?'
    this._installHook(idolId, entry.spine)
    void this._loadMouthSetting(idolId, entry.spine)
  }

  clearPending(idolId = null) {
    for (const [id, load] of this._mouthLoads) {
      if (idolId && id !== idolId) continue
      load.controller.abort()
      this._mouthLoads.delete(id)
    }
    if (idolId) {
      delete this.pendingTalking[idolId]
      return
    }
    this.pendingTalking = {}
  }

  _installHook(idolId, spine) {
    if (spine._lipSyncHooked) return
    const skeleton = spine.skeleton
    const mouthBone = skeleton.findBone('mouth')
    const slots = Object.keys(LIP_SLOTS).map(name => [skeleton.findSlotIndex(name), name]).filter(([index]) => index >= 0)
    const setAttachment = (slotIndex, name) => {
      skeleton.slots[slotIndex].setAttachment(name ? skeleton.getAttachment(slotIndex, name) : null)
    }
    const setNamedAttachments = (items) => {
      for (const item of Array.isArray(items) ? items : []) {
        const index = item?.slotName ? skeleton.findSlotIndex(item.slotName) : -1
        if (index >= 0) setAttachment(index, item.attachmentName)
      }
    }
    const trackAnimation = track => spine.state.tracks[track]?.animation?.name || null

    const origUpdateWT = skeleton.updateWorldTransform
    skeleton.updateWorldTransform = function (...args) {
      try {
        const sample = spine.customIsTalking ? lipSample(spine.getVoiceVolume) : null
        if (sample) spine._shouldCloseMouth = true
        const mouthes = spine._mouthData?.mouthes
        const animation = trackAnimation(SPINE_TRACK.face) || trackAnimation(SPINE_TRACK.body)
        const info = (sample || spine._shouldCloseMouth) && mouthes?.find(entry => entry.animationName === animation)
        if (info && !info.turnOffLipSync && mouthBone) {
          const open = sample && sample.y !== 0
          if (open) {
            mouthBone.scaleY = sample.x
            mouthBone.scaleX = sample.y * info.openMouthScale
          } else {
            mouthBone.scaleY = 1
            mouthBone.scaleX = info.closeMouthScale
          }
          for (const [index, name] of slots) {
            const field = LIP_SLOTS[name][open ? 0 : 1]
            setAttachment(index, field ? info[field] : null)
          }
          setNamedAttachments(open ? info.attachmentsWhenOpenMouth : info.attachmentsWhenCloseMouth)
        }
      } catch (e) {
        console.warn(`[LipSync] updateWorldTransform error for "${idolId}":`, e)
      } finally {
        origUpdateWT.apply(this, args)
      }
    }
    spine._lipSyncHooked = true
  }

  async _loadMouthSetting(idolId, spine) {
    if (spine._mouthData) return spine._mouthData
    const prior = this._mouthLoads.get(idolId)
    if (prior?.spine === spine) return prior.promise
    prior?.controller.abort()
    const controller = new AbortController()
    const record = { controller, spine, promise: null }
    this._mouthLoads.set(idolId, record)
    record.promise = withLoadDeadline(async signal => {
      const candidates = mouthSettingCandidates(idolId, spine._modelName || '')
      for (let index = 0; index < candidates.length; index++) {
        let data
        try { data = await storyAssetTransport.getJson(this.getMouthSettingUrl(candidates[index]), { signal }) }
        catch (error) {
          if ([404, 410].includes(error.status) && index + 1 < candidates.length) continue
          throw error
        }
        signal.throwIfAborted()
        if (this.getSpineEntry?.(idolId)?.spine !== spine || spine.destroyed) return null
        if (!Array.isArray(data?.mouthes) || !data.mouthes.length) return null
        if (data.mouthes.length) {
          spine._mouthData = data
          if (spine.customIsTalking) { try { spine.skeleton.updateWorldTransform() } catch {} }
          return data
        }
      }
      return null
    }, { signal: controller.signal, timeoutMs: 8000, label: 'optional-mouth-config' })
      .catch(() => null) // mouth shape remains optional; never blocks audible speech
      .finally(() => { if (this._mouthLoads.get(idolId) === record) this._mouthLoads.delete(idolId) })
    return record.promise
  }
}
