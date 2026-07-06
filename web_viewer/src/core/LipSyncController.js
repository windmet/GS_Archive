import { getMouthSettingUrl as defaultGetMouthSettingUrl } from '../utils/AssetResolver.js'

const ORIGINAL_LIP_OPEN_THRESHOLD = 0.04
const ORIGINAL_LIP_SCALE_MIN = 1.0
const FALLBACK_LIP_OPEN_SCALE = 3.0

// Keep this object even while empty. The lip calculation references it directly,
// and future per-character compensation should be added here instead of changing
// the core rig logic.
const LIP_OPEN_SCALE_OVERRIDE = {
  // 044ame: mouth slot on mouth_close, mouth bone was incorrectly reset to 1.0.
  // Fixed by scaling mouth alongside mouth_close in child-style rigs.
}

// Characters whose mouth mesh has mouth_close in its bone weights, so
// scaling mouth_close deforms the face. Use the `mouth` bone instead
// (not in mesh weights) — attachment switching provides the open shape.
const USE_MOUTH_BONE_FOR_SCALE = new Set([
  '037jir',
])

export class LipSyncController {
  constructor({
    getSpineEntry,
    getMouthSettingUrl = defaultGetMouthSettingUrl,
  }) {
    this.getSpineEntry = getSpineEntry
    this.getMouthSettingUrl = getMouthSettingUrl
    this.pendingTalking = {}
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

  clearPending(idolId = null) {
    if (idolId) {
      delete this.pendingTalking[idolId]
      return
    }
    this.pendingTalking = {}
  }

  _installHook(idolId, spine) {
    if (spine._lipSyncHooked) return

    const mouthSlot = spine.skeleton.slots.find(s => /^mouth$/i.test(s.data.name))
    const mouthClipSlot = spine.skeleton.slots.find(s => /^mouth_clip$/i.test(s.data.name))
    const tongueSlot = spine.skeleton.slots.find(s => /^tongue$/i.test(s.data.name))
    // Some sub-models (244sub) have "tooth" slot instead of "tooth_top"/"tooth_bottom"
    const toothTopSlot = spine.skeleton.slots.find(s => /^tooth_top$/i.test(s.data.name)) || spine.skeleton.slots.find(s => /^tooth$/i.test(s.data.name))
    const toothBotSlot = spine.skeleton.slots.find(s => /^tooth_bottom$/i.test(s.data.name))
    // Cache chin_beard slot for draw-order promotion during open mouth
    spine._beardSlot = spine.skeleton.findSlot('chin_beard')
    if (!mouthSlot) return

    const mouthBone = spine.skeleton.findBone('mouth')
    const mouthCloseBone = spine.skeleton.findBone('mouth_close')
    const mouthClipBone = spine.skeleton.findBone('mouth_clip')
    const chinControlBone = spine.skeleton.findBone('chin_control')
    const chinControlBaseY = chinControlBone ? chinControlBone.data.y : 0
    const mouthSlotBone = mouthSlot.bone?.data?.name || 'mouth'
    const isChildRig = mouthSlotBone === 'mouth_close'
    // Some characters (037jir) have mouth mesh weighted to mouth_close, so
    // scaling mouth_close deforms the face. Use the `mouth` bone instead.
    const useMouthBone = isChildRig && USE_MOUTH_BONE_FOR_SCALE.has(idolId)
    const activeMouthBone = useMouthBone ? (mouthBone || mouthSlot.bone)
      : isChildRig ? (mouthCloseBone || mouthSlot.bone)
      : (mouthBone || mouthSlot.bone)
    const activeMouthDataScaleX = activeMouthBone ? activeMouthBone.data.scaleX : 1
    const activeMouthDataScaleY = activeMouthBone ? activeMouthBone.data.scaleY : 1

    this._logRigDiagnostics(idolId, spine, {
      mouthSlot,
      mouthBone,
      mouthCloseBone,
      chinControlBone,
      activeMouthBone,
      isChildRig,
    })
    // Log child-rig slot/bone info once for debugging mismatch issues
    if (isChildRig && !spine._subDumpLogged) {
      spine._subDumpLogged = true
      const allSlots = spine.skeleton.slots.map(s => `${s.data.name}(bone=${s.bone?.data?.name || '?'})`).join(', ')
      const allBones = spine.skeleton.bones.map(b => `${b.data.name}(sX=${b.data.scaleX},sY=${b.data.scaleY},parent=${b.parent?.data?.name || 'root'},len=${b.data.length})`).join(', ')
      console.log(`[RigDump] ${idolId} (model=${spine._modelName || '?'}) slots=[${allSlots}]`)
      console.log(`[RigDump] ${idolId} bones=[${allBones}]`)
      console.log(`[RigDump] ${idolId} mouthClipSlot=${!!mouthClipSlot} tongueSlot=${!!tongueSlot} toothTopSlot=${!!toothTopSlot} toothBotSlot=${!!toothBotSlot}`)
    }

    const resetBoneScale = (bone) => {
      if (!bone) return
      bone.scaleX = bone.data.scaleX
      bone.scaleY = bone.data.scaleY
    }
    const setSlotAttachment = (slotName, attachmentName) => {
      const slot = spine.skeleton.findSlot(slotName)
      if (!slot) return
      spine.skeleton.setAttachment(slotName, attachmentName || null)
    }
    const applyAttachmentList = (items) => {
      if (!Array.isArray(items)) return
      for (const item of items) {
        if (!item?.slotName) continue
        setSlotAttachment(item.slotName, item.attachmentName || null)
      }
    }
    const resetMouthBones = (closeScale = ORIGINAL_LIP_SCALE_MIN) => {
      if (activeMouthBone) {
        activeMouthBone.scaleX = activeMouthDataScaleX * closeScale
        activeMouthBone.scaleY = activeMouthDataScaleY
      }
      if (mouthBone && mouthBone !== activeMouthBone) {
        // 044ame-style rigs need mouth and mouth_close kept in sync.
        mouthBone.scaleX = mouthBone.data.scaleX * closeScale
        mouthBone.scaleY = mouthBone.data.scaleY
      }
      if (mouthCloseBone && mouthCloseBone !== activeMouthBone) resetBoneScale(mouthCloseBone)
      if (chinControlBone) chinControlBone.y = chinControlBaseY
      if (mouthClipBone) mouthClipBone.scaleX = mouthClipBone.data.scaleX
      // Reset child bones of activeMouthBone to data values on close
      if (isChildRig && activeMouthBone) {
        for (const bone of spine.skeleton.bones) {
          if (bone.parent === activeMouthBone && /tooth|tongue|teeth/i.test(bone.data.name)) {
            bone.scaleX = bone.data.scaleX
            bone.x = bone.data.x
          }
        }
      }
    }
    const closeMouth = (exp, mouthEntry, currentAttName) => {
      const closeName = mouthEntry?.closeMouthAttachmentName || `mouth_${exp}1`
      if (currentAttName !== closeName) {
        spine.skeleton.setAttachment('mouth', closeName)
      }
      resetMouthBones(mouthEntry?.closeMouthScale ?? ORIGINAL_LIP_SCALE_MIN)
      applyAttachmentList(mouthEntry?.attachmentsWhenCloseMouth)
      if (tongueSlot) spine.skeleton.setAttachment('tongue', null)
      if (toothTopSlot) spine.skeleton.setAttachment('tooth_top', null)
      if (toothBotSlot) spine.skeleton.setAttachment('tooth_bottom', null)
      if (mouthClipSlot) spine.skeleton.setAttachment('mouth_clip', null)
    }

    const origUpdateWT = spine.skeleton.updateWorldTransform
    spine.skeleton.updateWorldTransform = function () {
      try {
        const currentAtt = mouthSlot.attachment
        if (!currentAtt?.name) return

        const match = currentAtt.name.match(/^(mouth_(.+?))(\d)$/i)
        if (!match) return

        const exp = match[2]
        const mouthEntry = spine._mouthData?.mouthes?.find(m => m.animationName === `face_${exp}`) || null

        if (!spine._lipAttachChecked) {
          spine._lipAttachChecked = true
          logAttachmentDiagnostics(idolId, spine, currentAtt, mouthSlot)
        }

        const lipValue = (spine.customIsTalking && spine.getVoiceVolume)
          ? Math.min(1, Math.max(0, spine.getVoiceVolume()))
          : 0
        const isOpen = !mouthEntry?.turnOffLipSync && lipValue > ORIGINAL_LIP_OPEN_THRESHOLD

        if (isOpen) {
          const openName = mouthEntry?.openMouthAttachmentName || `mouth_${exp}2`
          if (currentAtt.name !== openName) {
            spine.skeleton.setAttachment('mouth', openName)
          }

          const openRatio = lipValue
          const mouthOpenScale = (mouthEntry?.openMouthScale ?? FALLBACK_LIP_OPEN_SCALE) * (LIP_OPEN_SCALE_OVERRIDE[idolId] || 1)
          const dynScaleY = ORIGINAL_LIP_SCALE_MIN + openRatio * (mouthOpenScale - ORIGINAL_LIP_SCALE_MIN)

          logPreScaleDiagnostics(idolId, spine, exp, mouthBone, mouthCloseBone, chinControlBone)

          if (activeMouthBone) {
            activeMouthBone.scaleX = activeMouthDataScaleX * dynScaleY
            activeMouthBone.scaleY = activeMouthDataScaleY
          }
          if (chinControlBone) chinControlBone.y = chinControlBaseY
          if (isChildRig && mouthBone && mouthBone !== activeMouthBone) {
            mouthBone.scaleX = mouthBone.data.scaleX * dynScaleY
            mouthBone.scaleY = mouthBone.data.scaleY
          }
          // Scale mouth_clip bone alongside active mouth bone so the clip region
          // expands with the mouth opening, hiding deformed interior parts (244sub
          // has tooth mesh weighted to mouth_close). Skip if mouth_clip bone isn't
          // a head sibling (037jir's mouth_clip is a neck child — scaling it would
          // distort unrelated face/neck areas).
          if (mouthClipBone && isChildRig && mouthClipBone.parent?.data?.name === 'head') {
            mouthClipBone.scaleX = mouthClipBone.data.scaleX * dynScaleY
          }
          // Compensate tooth children of activeMouthBone so they don't inherit
          // the lip-sync scaleX (244sub: tooth → mouth_close). Parent only
          // scales in X, so only compensate scaleX and x (not scaleY/y).
          if (isChildRig && activeMouthBone && dynScaleY !== 1) {
            for (const bone of spine.skeleton.bones) {
              if (bone.parent === activeMouthBone && /tooth|tongue|teeth/i.test(bone.data.name)) {
                bone.scaleX /= dynScaleY
                bone.x /= dynScaleY
              }
            }
          }
          logScaleDiagnostics(idolId, spine, exp, openRatio, mouthOpenScale, dynScaleY, activeMouthDataScaleX, activeMouthBone)

          if (mouthBone && mouthBone !== activeMouthBone && !isChildRig) resetBoneScale(mouthBone)
          if (mouthCloseBone && mouthCloseBone !== activeMouthBone) resetBoneScale(mouthCloseBone)
          applyAttachmentList(mouthEntry?.attachmentsWhenOpenMouth)
          if (tongueSlot) {
            const tName = mouthEntry?.tongueAttachmentName || null
            spine.skeleton.setAttachment('tongue', tName || null)
          }
          if (toothTopSlot) {
            const tName = mouthEntry?.upperTeethAttachmentName || null
            spine.skeleton.setAttachment('tooth_top', tName || null)
          }
          if (toothBotSlot) {
            const tName = mouthEntry?.lowerTeethAttachmentName || null
            spine.skeleton.setAttachment('tooth_bottom', tName || null)
          }
          if (mouthClipSlot) {
            const cName = mouthEntry?.openMouthClipAttachmentName || null
            spine.skeleton.setAttachment('mouth_clip', cName || null)
          }

          // Log attachment per expression once each (to verify per-exp switching)
          if (isChildRig) {
            spine._loggedExps ??= []
            if (!spine._loggedExps.includes(exp)) {
              spine._loggedExps.push(exp)
              const toothTopAtt = toothTopSlot ? spine.skeleton.findSlot('tooth_top')?.attachment?.name || spine.skeleton.findSlot('tooth')?.attachment?.name || 'none' : 'none'
              const toothBotAtt = toothBotSlot ? spine.skeleton.findSlot('tooth_bottom')?.attachment?.name || 'none' : 'none'
              const tongueAtt = tongueSlot ? spine.skeleton.findSlot('tongue')?.attachment?.name || 'none' : 'none'
              const clipAtt = mouthClipSlot ? spine.skeleton.findSlot('mouth_clip')?.attachment?.name || 'none' : 'none'
              console.log(`[LipTooth] ${idolId} exp=${exp} tooth_top=${toothTopAtt} tooth_bottom=${toothBotAtt} tongue=${tongueAtt} clip=${clipAtt}`)
            }
          }

          // Promote chin_beard slot to the top of draw order so it renders
          // over the open mouth interior (preventing beard from being hidden).
          if (spine._beardSlot) {
            if (!spine._beardDrawSaved) {
              spine._beardDrawSaved = [...spine.skeleton.drawOrder]
            }
            const doArr = spine.skeleton.drawOrder
            const bi = doArr.indexOf(spine._beardSlot)
            if (bi >= 0 && bi < doArr.length - 1) {
              doArr.splice(bi, 1)
              doArr.push(spine._beardSlot)
            }
          }

          if (!spine._lipSyncDumpFired) {
            if (spine._lipSyncDumpCounter === undefined) spine._lipSyncDumpCounter = 0
            spine._lipSyncDumpCounter++
            if (spine._lipSyncDumpCounter >= 3) {
              spine._lipSyncDumpFired = true
              console.log(`[LipSync] ${idolId} exp=${exp} mode=original value=${lipValue.toFixed(3)}`)
            }
          }
        } else {
          closeMouth(exp, mouthEntry, currentAtt.name)
          // Restore original draw order when mouth closes
          if (spine._beardSlot && spine._beardDrawSaved) {
            spine.skeleton.drawOrder = spine._beardDrawSaved
            spine._beardDrawSaved = null
          }
        }
      } catch (e) {
        console.warn(`[LipSync] updateWorldTransform error for "${idolId}":`, e)
      } finally {
        origUpdateWT.call(this)
      }
    }

    spine._lipSyncHooked = true
    if (typeof window !== 'undefined') {
      if (!window._s) window._s = {}
      window._s[idolId] = spine
      if (!window._probe) window._probe = {}
      window._probe[idolId] = () => {
        console.log(`[Probe] ${idolId} available via window._s['${idolId}']`)
      }
      // Debug: hide all face slots except mouth/chin_beard to isolate mesh stretching
      if (idolId === '037jir') {
        window._hideFaceParts = (id) => {
          const s = window._s[id || '037jir']
          if (!s) return console.log('no spine')
          s.skeleton.slots.forEach(sl => {
            const n = sl.data.name
            if (/^(cheek|face_shadow|nose|ear|eyebrow|eyelash|eyewhite|eyelight|eyeline)/i.test(n)) {
              console.log(`[HideFace] hiding slot="${n}" had att="${sl.attachment?.name || '(none)'}"`)
              sl.attachment = null
            }
          })
          console.log('[HideFace] done — non-mouth face slots hidden')
        }
        window._showFaceParts = (id) => {
          const s = window._s[id || '037jir']
          if (!s) return console.log('no spine')
          s.skeleton.setToSetupPose()
          console.log('[HideFace] restored via setToSetupPose')
        }
        window._listFaceSlots = (id) => {
          const s = window._s[id || '037jir']
          if (!s) return console.log('no spine')
          s.skeleton.slots.forEach(sl => {
            const n = sl.data.name
            if (/^(mouth|nose|ear|face|chin|beard|cheek|jaw|tooth|tongue|clip)/i.test(n)) {
              console.log(`[ListFace] slot="${n}" bone="${sl.bone?.data?.name}" att="${sl.attachment?.name || '(none)'}"`)
            }
          })
        }
        console.log('[Debug] 037jir face tools: _listFaceSlots(), _hideFaceParts(), _showFaceParts()')
      }
      // Global rig comparison tool — call window._compareRigs() to see all
      if (!window._compareRigs) {
        window._compareRigs = () => {
          const entries = Object.entries(window._s || {}).filter(([, s]) => s?.skeleton)
          for (const [id, s] of entries) {
            const slot = s.skeleton.slots.find(sl => /^mouth$/i.test(sl.data.name))
            if (!slot) continue
            const slotBoneName = slot.bone?.data?.name || '?'
            const isChild = slotBoneName === 'mouth_close'
            const att = slot.attachment
            const isMesh = att?.type === 2
            const isRegion = att?.type === 0
            let meshBones = ''
            if (att?.bones) {
              const unique = [...new Set(Array.from(att.bones).map(bi => {
                const b = s.skeleton.bones[bi]
                return b ? b.data.name : `?`
              }))]
              meshBones = unique.join(',')
            }
            const mouthBone = s.skeleton.findBone('mouth')
            const closeBone = s.skeleton.findBone('mouth_close')
            const mSX = mouthBone?.scaleX?.toFixed(3) ?? '-'
            const cSX = closeBone?.scaleX?.toFixed(3) ?? '-'
            const openScale = s._mouthData?.mouthes?.[0]?.openMouthScale ?? '?'
            console.log(
              `[RigCmp] ${id}: ${isChild ? 'CHILD' : 'ADULT'} ` +
              `slotBone=${slotBoneName} ` +
              `attType=${isMesh ? 'MESH' : isRegion ? 'REGION' : '?'} ` +
              `${meshBones ? `meshWt=[${meshBones}] ` : ''}` +
              `mouth.scaleX=${mSX} mouth_close.scaleX=${cSX} ` +
              `openScale=${openScale}`
            )
          }
        }
        console.log('[Debug] Rig compare: window._compareRigs()')
      }
    }
  }

  async _loadMouthSetting(idolId, spine) {
    // Some models (e.g. 244sub_001_00 for 040ren's child variant) have their own
    // mouth setting file keyed by model prefix, not idolId.
    const modelId = spine._modelName || ''
    const modelPrefix = modelId.replace(/_\d{3}_\d{2}$/, '')  // "244sub_001_00" → "244sub"
    const primaryId = (modelPrefix && modelPrefix !== idolId) ? modelPrefix : idolId
    try {
      const resp = await fetch(this.getMouthSettingUrl(primaryId))
      if (!resp.ok && primaryId !== idolId) {
        // Fall back to idolId-based mouth setting for models without their own.
        const fallback = await fetch(this.getMouthSettingUrl(idolId))
        if (!fallback.ok) return
        const data = await fallback.json()
        if (data?.mouthes?.length) {
          spine._mouthData = data
          console.log(`[LipMouth] ${idolId} model "${modelId}" has no own mouth setting, using idolId`)
          if (spine.customIsTalking) {
            try { spine.skeleton.updateWorldTransform() } catch (_) {}
          }
        }
        return
      }
      if (!resp.ok) return
      const data = await resp.json()
      if (data?.mouthes?.length) {
        spine._mouthData = data
        if (primaryId !== idolId) {
          console.log(`[LipMouth] ${idolId} using model-specific mouth setting: ${primaryId}`)
        }
        if (spine.customIsTalking) {
          try {
            spine.skeleton.updateWorldTransform()
          } catch (_) {}
        }
      }
    } catch (_) {
      // Silently fall back to fallback constants.
    }
  }

  _logRigDiagnostics(idolId, spine, { mouthSlot, mouthBone, mouthCloseBone, chinControlBone, activeMouthBone, isChildRig }) {
    const shouldLog = idolId === '044ame' || idolId === '001tom' || idolId === '040ren' || idolId === '047shu' || idolId === '037jir'
    if (!shouldLog) return

    const mouthBoneDS = mouthBone ? `mouth(data.scaleX=${mouthBone.data.scaleX})` : 'mouth(not-found)'
    const mouthCloseDS = mouthCloseBone ? `mouth_close(data.scaleX=${mouthCloseBone.data.scaleX})` : 'mouth_close(not-found)'
    const slotBoneName = mouthSlot.bone?.data?.name || '(no-bone)'
    const activeBoneName = activeMouthBone?.data?.name || '(none)'
    const mouthParent = mouthBone ? mouthBone.parent?.data?.name || '(root)' : 'N/A'
    const closeParent = mouthCloseBone ? mouthCloseBone.parent?.data?.name || '(root)' : 'N/A'
    const mouthRotation = mouthBone ? mouthBone.data.rotation : 'N/A'
    const closeRotation = mouthCloseBone ? mouthCloseBone.data.rotation : 'N/A'
    const mouthLength = mouthBone ? mouthBone.data.length : 'N/A'
    const closeLength = mouthCloseBone ? mouthCloseBone.data.length : 'N/A'
    const slotsOnMouthBone = spine.skeleton.slots.filter(s => s.bone?.data?.name === 'mouth').map(s => s.data.name).join(',') || 'none'
    const slotsOnCloseBone = spine.skeleton.slots.filter(s => s.bone?.data?.name === 'mouth_close').map(s => s.data.name).join(',') || 'none'
    const toothBone = spine.skeleton.findBone('tooth')
    const toothInfo = toothBone ? `tooth(rot=${toothBone.data.rotation},sX=${toothBone.data.scaleX},sY=${toothBone.data.scaleY},parent=${toothBone.parent?.data?.name})` : 'tooth(not-found)'
    const mouthBX = mouthBone ? mouthBone.data.x : 'N/A'
    const mouthBY = mouthBone ? mouthBone.data.y : 'N/A'
    const closeBX = mouthCloseBone ? mouthCloseBone.data.x : 'N/A'
    const closeBY = mouthCloseBone ? mouthCloseBone.data.y : 'N/A'

    console.log(`[LipRig] ${idolId}: slotBone="${slotBoneName}" childRig=${isChildRig} activeBone="${activeBoneName}"`)
    console.log(`[LipRig]   ${mouthBoneDS} ${mouthCloseDS}`)
    console.log(`[LipRig]   mouth(parent=${mouthParent},pos=(${mouthBX},${mouthBY}),rot=${mouthRotation},len=${mouthLength},sX=${mouthBone?.data?.scaleX}) mouth_close(parent=${closeParent},pos=(${closeBX},${closeBY}),rot=${closeRotation},len=${closeLength},sX=${mouthCloseBone?.data?.scaleX}) ${toothInfo}`)
    console.log(`[LipRig]   slotsOn_mouth=[${slotsOnMouthBone}] slotsOn_mouth_close=[${slotsOnCloseBone}] chin_control=${chinControlBone ? 'found' : 'not-found'}`)

    // 037jir: dump ALL bones with parent hierarchy for mesh weight analysis
    if (idolId === '037jir') {
      const allBones = spine.skeleton.bones.map(b => `${b.data.name}(parent=${b.parent?.data?.name||'root'},sX=${b.data.scaleX},sY=${b.data.scaleY},len=${b.data.length})`)
      console.log(`[RigBones] ${idolId} ALL bones:`)
      for (const line of allBones) console.log(`[RigBones]   ${line}`)
      // Also dump the current mouth attachment's bone weights if available
      try {
        const mouthAtt = spine.skeleton.findSlot('mouth')?.attachment
        if (mouthAtt && mouthAtt.bones) {
          const uniqueBones = [...new Set(Array.from(mouthAtt.bones).map(bi => {
            const b = spine.skeleton.bones[bi]
            return b ? b.data.name : `unknown`
          }))]
          console.log(`[RigBones]   current mouth att="${mouthAtt.name}" type=${mouthAtt.type} uniqueBones=[${uniqueBones.join(', ')}]`)
        }
      } catch (_) {}
    }
  }
}

function logAttachmentDiagnostics(idolId, spine, att, mouthSlot) {
  if (idolId !== '044ame' && idolId !== '040ren' && idolId !== '037jir') return
  const isMesh = att.type === 2
  const isRegion = att.type === 0
  let meshBones = 'N/A'
  if (isMesh && att.bones) {
    meshBones = Array.from(att.bones).map(bi => {
      const b = spine.skeleton.bones[bi]
      return b ? b.data.name : `idx${bi}`
    }).join(',')
  }
  console.log(`[LipAttach] ${idolId} att="${att.name}" type=${isMesh ? 'MESH' : isRegion ? 'REGION' : 'UNKNOWN'} meshBones=[${meshBones}] slotBone=${mouthSlot.bone?.data?.name}`)
  // On first attach check, also dump all face slots and their bone bindings
  if (idolId === '037jir' && !spine._faceSlotDumped) {
    spine._faceSlotDumped = true
    const faceSlots = spine.skeleton.slots.filter(s => /^(mouth|nose|ear|face|chin|beard|mustache|cheek|jaw|whisker|eyebrow|eyelash)/i.test(s.data.name))
    console.log(`[FaceSlots] ${idolId} face-related slot→bone mappings:`)
    for (const s of faceSlots) {
      const attName = s.attachment?.name || '(none)'
      const boneName = s.bone?.data?.name || '(none)'
      console.log(`[FaceSlots]   slot="${s.data.name}" bone="${boneName}" att="${attName}"`)
    }
    // Also dump all bones with parent chain for rig analysis
    const allBones = spine.skeleton.bones.map(b => `${b.data.name}(parent=${b.parent?.data?.name||'root'},sX=${b.data.scaleX},sY=${b.data.scaleY},len=${b.data.length})`)
    console.log(`[FaceSlots] ${idolId} ALL bones:`)
    for (const line of allBones) console.log(`[FaceSlots]   ${line}`)
    // Also dump which bones the mouth mesh is weighted to
    const mouthAtt = spine.skeleton.findSlot('mouth')?.attachment
    if (mouthAtt && mouthAtt.bones && mouthAtt.vertices) {
      const uniqueBones = [...new Set(Array.from(mouthAtt.bones).map(bi => {
        const b = spine.skeleton.bones[bi]
        return b ? b.data.name : `unknown`
      }))]
      console.log(`[FaceSlots] mouth mesh has ${mouthAtt.bones.length} bone entries, ${uniqueBones.length} unique bones: [${uniqueBones.join(', ')}]`)
    }
  }
}

function logPreScaleDiagnostics(idolId, spine, exp, mouthBone, mouthCloseBone, chinControlBone) {
  if ((idolId !== '044ame' && idolId !== '001tom' && idolId !== '040ren' && idolId !== '037jir') || spine._lipSyncDumpCounter >= 1) return
  const preMouthScaleX = mouthBone ? mouthBone.scaleX : -1
  const preCloseScaleX = mouthCloseBone ? mouthCloseBone.scaleX : -1
  const preChinY = chinControlBone ? chinControlBone.y : -999
  console.log(`[LipBonePre] ${idolId} exp=${exp} mouth.scaleX=${preMouthScaleX.toFixed(3)} mouth_close.scaleX=${preCloseScaleX.toFixed(3)} chin_control.y=${preChinY.toFixed(1)}`)
}

function logScaleDiagnostics(idolId, spine, exp, openRatio, mouthOpenScale, dynScaleY, activeMouthDataScaleX, activeMouthBone) {
  if ((idolId !== '044ame' && idolId !== '001tom' && idolId !== '040ren' && idolId !== '037jir') || spine._lipSyncDumpFired || spine._lipSyncDumpCounter >= 3) return
  const finalScaleX = activeMouthBone ? activeMouthBone.scaleX.toFixed(3) : 'N/A'
  console.log(`[LipCalc] ${idolId} exp=${exp} openRatio=${openRatio.toFixed(3)} mouthOpenScale=${mouthOpenScale} dynScaleY=${dynScaleY.toFixed(3)} baseDataScaleX=${activeMouthDataScaleX} finalScaleX=${finalScaleX}`)
}
