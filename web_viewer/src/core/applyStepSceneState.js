export function applyStepSceneState({
  manager,
  step,
  state,
  lastScreenEffectsKey = '',
  resetScreenEffects = false,
}) {
  if (!manager || !state) return lastScreenEffectsKey

  if (resetScreenEffects) {
    manager.clearScreenEffects?.()
    lastScreenEffectsKey = ''
  }

  manager.setCameraFilter(null)
  manager.applyBgEffects?.(state.bg_effects || [], state.bg_profile || null)

  if (state.camera_filter) manager.setCameraFilter(state.camera_filter)

  const bgDofTransition = state.bg_dof_transition || {}
  const bgColorTransition = state.bg_color_transition || {}
  const keepHeartVoiceBlur = state.bg_color && state.bg_color !== '#FFFFFF'
  manager.setBgBlur(
    keepHeartVoiceBlur && state.bg_dof ? state.bg_dof * 6 : 0,
    bgDofTransition.duration ?? 0,
    bgDofTransition.delay ?? 0,
  )
  manager.setBgColorOverlay(
    state.bg_color || null,
    bgColorTransition.duration ?? 0,
    bgColorTransition.delay ?? 0,
  )

  const screenEffects = (state.screen_effects || [])
    .filter(effect => effect?.type !== 'fadein' && effect?.type !== 'fadeout')
  const screenEffectsKey = `${step?.step_id || ''}:${JSON.stringify(screenEffects)}`
  if (screenEffects.length && screenEffectsKey !== lastScreenEffectsKey) {
    manager.playScreenEffects?.(screenEffects)
    return screenEffectsKey
  }
  if (!screenEffects.length) return ''
  return lastScreenEffectsKey
}
