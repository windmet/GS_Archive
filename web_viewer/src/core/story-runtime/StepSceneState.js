export function getStepSceneState(step) {
  if (step?.entry_snapshot && typeof step.entry_snapshot === 'object') return step.entry_snapshot
  if (step?.state && typeof step.state === 'object') return step.state
  return null
}

export function projectStepSceneState(step, override = null) {
  if (!step || typeof step !== 'object') return step
  const state = override && typeof override === 'object' ? override : getStepSceneState(step)
  if (!state || step.state === state) return step
  return { ...step, state }
}
