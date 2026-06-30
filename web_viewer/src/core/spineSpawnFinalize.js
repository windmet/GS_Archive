import * as PIXI from 'pixi.js'

export function finalizeSpawnedSpine({
  manager,
  spine,
  modelId,
  idolId,
  animNames,
  options,
  spawnToken,
  spineContainer,
  debugMode,
  pendingTalking,
  getDefaultBodyAnim,
  captureBaselineBounds,
  fadeIn,
  setSpineTalking,
}) {
  const marker = new PIXI.Graphics()
  marker.beginFill(0xff0000)
  marker.drawCircle(0, 0, 8)
  marker.endFill()
  marker.beginFill(0xffffff)
  marker.drawCircle(0, 0, 3)
  marker.endFill()
  marker.visible = debugMode
  manager._debugOverlay?.addChild(marker)

  const fadeWrapper = new PIXI.Container()
  fadeWrapper.addChild(spine)
  if (manager._spawnTokens[idolId] !== spawnToken) {
    fadeWrapper.destroy({ children: true, texture: false, baseTexture: false })
    return null
  }
  spineContainer.addChild(fadeWrapper)
  manager.spineInstances[idolId] = {
    spine,
    modelId,
    bodyType: options.bodyType ?? null,
    marker,
    wrapper: fadeWrapper,
    spawnToken,
    prefabMeta: options.prefabMeta || null,
    scaleConfig: spine._scaleConfig || null,
    positionMode: null,
    targetVisualBottom: null,
    baselineCapturedAt: null,
    baselineCaptureReason: null,
    baselineBodyAnim: null,
    baselineFaceAnim: null,
    baselineTracks: null,
    baselineSkeletonLocalBounds: null,
  }

  if (animNames.length > 0) {
    const defaultBody = getDefaultBodyAnim(animNames)
    if (defaultBody) {
      spine.state.setAnimation(0, defaultBody, true)
      spine._currentBodyAnim = defaultBody
    }
    if (animNames.includes('face_default')) {
      spine.state.setAnimation(1, 'face_default', true)
      spine._currentFaceAnim = 'face_default'
      spine._currentFaceKey = null
    } else if (animNames.some(n => n.startsWith('face_'))) {
      const firstFace = animNames.find(n => n.startsWith('face_'))
      spine.state.setAnimation(1, firstFace, true)
      spine._currentFaceAnim = firstFace
      spine._currentFaceKey = null
    }
  }

  spine.update(0)
  captureBaselineBounds(idolId)

  const queuedTalking = pendingTalking?.[idolId]
  if (queuedTalking) {
    delete pendingTalking[idolId]
    setSpineTalking(idolId, true, queuedTalking.volumeCallback)
  }

  fadeIn(spine, options.fadeInDuration)
  return { marker, wrapper: fadeWrapper }
}
