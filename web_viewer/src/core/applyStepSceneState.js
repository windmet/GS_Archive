export function applyStepSceneState({
  manager,
  step,
  state,
  lastScreenEffectsKey = '',
  resetScreenEffects = false,
  nowMilliseconds,
}) {
  if (!manager || !state) return lastScreenEffectsKey

  if (resetScreenEffects) {
    manager.clearScreenEffects?.()
    lastScreenEffectsKey = ''
  }

  manager.setCameraFilter(null)
  manager.applyBgEffects?.(state.bg_effects || [], state.bg_profile || null, nowMilliseconds)

  if (state.camera_filter) manager.setCameraFilter(state.camera_filter)

  const bgDofTransition = state.bg_dof_transition || {}
  const bgColorTransition = state.bg_color_transition || {}
  const background = manager.backgroundManager
  const previousBlurTween = background?._bgBlurTween, previousColorTween = background?._bgColorTween
  const filterFrom = background ? {
    blur: background._bgBlurAmount || 0,
    overlay: background._bgOverlaySprite?.parent ? { visible: true,
      tint: background._bgOverlaySprite.tint, alpha: background._bgOverlaySprite.alpha } : { visible: false },
  } : null
  const keepHeartVoiceBlur = state.bg_color && state.bg_color !== '#FFFFFF'
  const blurCalledAt = nowMilliseconds?.()
  manager.setBgBlur(
    keepHeartVoiceBlur && state.bg_dof ? state.bg_dof * 6 : 0,
    bgDofTransition.duration ?? 0,
    bgDofTransition.delay ?? 0,
    nowMilliseconds,
  )
  const overlayCalledAt = nowMilliseconds?.()
  manager.setBgColorOverlay(
    state.bg_color || null,
    bgColorTransition.duration ?? 0,
    bgColorTransition.delay ?? 0,
    nowMilliseconds,
  )
  if (background) {
    // One bounded diagnostic record, bound to the actual projected step object.
    // Capture before setters; never infer an origin from a later sampled value.
    const blur = background._bgBlurTween !== previousBlurTween ? background._bgBlurTween : null
    const overlay = background._bgColorTween !== previousColorTween ? background._bgColorTween : null
    background._projectorFilterInvocation = { step, state: Object.fromEntries(
      ['bg_color', 'bg_dof', 'bg_color_transition', 'bg_dof_transition'].map(key => [key, state[key] == null ? null : JSON.parse(JSON.stringify(state[key]))])),
      from: filterFrom, handles: { blur, overlay }, calledAt: { blur: blurCalledAt, overlay: overlayCalledAt },
      observedHandles: { blur: background._bgBlurTween, overlay: background._bgColorTween } }
  }

  const screenEffects = (state.screen_effects || [])
    .filter(effect => effect?.type !== 'fadein' && effect?.type !== 'fadeout')
  const screenEffectsKey = `${step?.step_id || ''}:${JSON.stringify(screenEffects)}`
  if (screenEffects.length && screenEffectsKey !== lastScreenEffectsKey) {
    manager.playScreenEffects?.(screenEffects, { nowMilliseconds })
    return screenEffectsKey
  }
  if (!screenEffects.length) return ''
  return lastScreenEffectsKey
}
