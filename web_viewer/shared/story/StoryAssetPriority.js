import { resolveStoryPlaybackWindow } from './StoryPlaybackWindow.js'

export const priorityRank = { critical: 0, near: 1, deferred: 2 }

/** Projection only: no branch selection, cue execution or readiness claim. */
export function createStoryAssetPriority(scenario, entry = {}, nearSteps = 3) {
  const window = resolveStoryPlaybackWindow(scenario, entry)
  const nearIndices = []
  for (let index = window.entryIndex; index < window.endIndex && nearIndices.length < nearSteps; index++) {
    const step = scenario.steps[index]
    if (step?.type === 'choice' || step?.flow?.advance === 'choice') break
    nearIndices.push(index + 1)
  }
  return { ...window, nearIndices }
}

export function assetPriority(asset, projection) {
  if (!projection) return 'deferred'
  if (asset.uses.some(use => use.stepIndex === projection.entryIndex)) return 'critical'
  if (asset.uses.some(use => projection.nearIndices.includes(use.stepIndex))) return 'near'
  return 'deferred'
}
