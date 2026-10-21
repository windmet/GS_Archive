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

  manager.setCameraFilter(state.camera_filter || null, state.camera_filter_transition || null, nowMilliseconds)
  manager.setIdolBackgroundColorFilter?.(state.bg_profile || null)
  manager.applyBgEffects?.(state.bg_effects || [], state.bg_profile || null, nowMilliseconds)

  const bgDofTransition = state.bg_dof_transition || {}
  const bgColorTransition = state.bg_color_transition || {}
  const background = manager.backgroundManager
  const previousBlurTween = background?._bgBlurTween, previousColorTween = background?._bgColorTween
  // SetOffsetBlur starts from the previous amount target; image_bg_color from the current colour.
  const filterFrom = background ? { blur: background._bgOffsetBlur ?? 0, color: background._bgColor ?? 0xFFFFFF } : null
  const blurCalledAt = nowMilliseconds?.()
  manager.setBgBlur(
    state.bg_dof ?? null,
    bgDofTransition.duration ?? 0,
    bgDofTransition.delay ?? 0,
    nowMilliseconds,
  )
  const colorCalledAt = nowMilliseconds?.()
  manager.setBgColor(
    state.bg_color || null,
    bgColorTransition.duration ?? 0,
    bgColorTransition.delay ?? 0,
    nowMilliseconds,
  )
  if (background) {
    // One bounded diagnostic record, bound to the actual projected step object.
    // Capture before setters; never infer an origin from a later sampled value.
    const blur = background._bgBlurTween !== previousBlurTween ? background._bgBlurTween : null
    const color = background._bgColorTween !== previousColorTween ? background._bgColorTween : null
    background._projectorFilterInvocation = { step, state: Object.fromEntries(
      ['bg_color', 'bg_dof', 'bg_color_transition', 'bg_dof_transition'].map(key => [key, state[key] == null ? null : JSON.parse(JSON.stringify(state[key]))])),
      from: filterFrom, handles: { blur, color }, calledAt: { blur: blurCalledAt, color: colorCalledAt },
      observedHandles: { blur: background._bgBlurTween, color: background._bgColorTween } }
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
